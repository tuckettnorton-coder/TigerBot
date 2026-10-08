package com.tigerfx.tigermacro;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.util.Identifier;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

public final class TigerMacroClient implements ClientModInitializer {
    private static final String CATEGORY_ID = "macro";
    private static final ScheduledExecutorService REPEAT_EXECUTOR = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread thread = new Thread(r, "Tiger Macro Repeater");
        thread.setDaemon(true);
        return thread;
    });

    private static MacroConfig config;
    private static KeyBinding toggleKey;
    private static KeyBinding macroKey;
    private static KeyBinding openMenuKey;

    private static ScheduledFuture<?> pendingRepeat;
    private static long repeatGeneration;
    private static boolean macroKeyHeld;
    private static int lastMacroKeyCode;
    private static boolean lastWindowFocused;
    private static Object lastWorld;
    private static Object lastScreen;
    private static boolean initialized;

    public static MacroConfig getConfig() {
        return config;
    }

    @Override
    public void onInitializeClient() {
        config = MacroConfig.load();

        KeyBinding.Category category = KeyBinding.Category.create(
                Identifier.of("tigermacro", CATEGORY_ID)
        );

        toggleKey = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.tigermacro.toggle",
                InputUtil.Type.KEYSYM,
                config.getToggleKeyCode(),
                category
        ));
        macroKey = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.tigermacro.macro_key",
                InputUtil.Type.KEYSYM,
                config.getMacroKeyCode(),
                category
        ));
        openMenuKey = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.tigermacro.open_menu",
                InputUtil.Type.KEYSYM,
                config.getOpenMenuKeyCode(),
                category
        ));

        lastMacroKeyCode = config.getMacroKeyCode();
        ClientTickEvents.END_CLIENT_TICK.register(TigerMacroClient::clientTick);

        Runtime.getRuntime().addShutdownHook(
                new Thread(TigerMacroClient::shutdownStatic, "Tiger Macro Shutdown")
        );

        initialized = true;
    }

    private static void clientTick(MinecraftClient client) {
        if (!initialized) return;

        syncBindingsToConfig();

        boolean focused = client.isWindowFocused();
        Object world = client.world;
        Object screen = client.currentScreen;

        if (focused != lastWindowFocused || world != lastWorld || screen != lastScreen) {
            cancelRepeatAndResync(client);
            lastWindowFocused = focused;
            lastWorld = world;
            lastScreen = screen;
        }

        // Use Minecraft's native keybind press queue for the two control keys.
        // This is the mechanism used by vanilla controls and avoids custom
        // GLFW polling edge cases.
        while (toggleKey.wasPressed()) {
            toggleMacro(client);
        }

        if (client.currentScreen == null) {
            while (openMenuKey.wasPressed()) {
                cancelRepeatAndResync(client);
                client.setScreen(new MacroScreen(null));
                return;
            }
        } else {
            // Consume queued menu-open presses while another screen is active so
            // a key press cannot be delayed and unexpectedly reopen the menu later.
            while (openMenuKey.wasPressed()) {
                // consumed
            }
            macroKeyHeld = physicallyHeld(client, config.getMacroKeyCode());
            return;
        }

        if (!focused || client.player == null || !config.isEnabled()) {
            stopPendingRepeatOnly();
            macroKeyHeld = physicallyHeld(client, config.getMacroKeyCode());
            return;
        }

        int macroKeyCode = config.getMacroKeyCode();
        if (macroKeyCode != lastMacroKeyCode) {
            cancelRepeatAndResync(client);
            lastMacroKeyCode = macroKeyCode;
        }

        boolean held = physicallyHeld(client, macroKeyCode);
        if (!held) {
            if (macroKeyHeld) {
                macroKeyHeld = false;
                stopPendingRepeatOnly();
            }
            return;
        }

        if (!macroKeyHeld) {
            macroKeyHeld = true;
            // The real physical press remains Minecraft's first action.
            // The repeater supplies only later actions.
            scheduleNextRepeat(client, config.getDelayMs());
        }
    }

    private static void toggleMacro(MinecraftClient client) {
        boolean newState = !config.isEnabled();
        config.setEnabled(newState);

        // Toggling is a hard state transition. Do not preserve the Macro Key's
        // held-state marker here, because doing that can prevent a clean restart
        // when the user toggles OFF and back ON without releasing Macro Key.
        repeatGeneration++;
        stopPendingRepeatOnly();
        macroKeyHeld = false;

        if (newState
                && client.currentScreen == null
                && client.player != null
                && client.isWindowFocused()
                && physicallyHeld(client, config.getMacroKeyCode())) {
            macroKeyHeld = true;
            scheduleNextRepeat(client, config.getDelayMs());
        }
    }

    private static void syncBindingsToConfig() {
        int toggleCode = KeyBindingHelper.getBoundKeyOf(toggleKey).getCode();
        int macroCode = KeyBindingHelper.getBoundKeyOf(macroKey).getCode();
        int openCode = KeyBindingHelper.getBoundKeyOf(openMenuKey).getCode();

        if (toggleCode != config.getToggleKeyCode()) {
            config.setToggleKeyCode(toggleCode);
        }
        if (macroCode != config.getMacroKeyCode()) {
            config.setMacroKeyCode(macroCode);
            macroKeyHeld = false;
            lastMacroKeyCode = macroCode;
            stopPendingRepeatOnly();
        }
        if (openCode != config.getOpenMenuKeyCode()) {
            config.setOpenMenuKeyCode(openCode);
        }
    }

    private static void scheduleNextRepeat(MinecraftClient client, long delayMs) {
        stopPendingRepeatOnly();

        final long generation = repeatGeneration;
        final long safeDelay = Math.max(
                MacroConfig.MIN_DELAY_MS,
                Math.min(MacroConfig.MAX_DELAY_MS, delayMs)
        );

        pendingRepeat = REPEAT_EXECUTOR.schedule(
                () -> client.execute(() -> {
                    if (generation != repeatGeneration) return;

                    pendingRepeat = null;

                    if (!config.isEnabled()
                            || client.player == null
                            || client.currentScreen != null
                            || !client.isWindowFocused()) {
                        return;
                    }

                    int keyCode = config.getMacroKeyCode();
                    if (!physicallyHeld(client, keyCode)) {
                        macroKeyHeld = false;
                        return;
                    }

                    InputUtil.Key boundKey = KeyBindingHelper.getBoundKeyOf(macroKey);
                    if (boundKey.getCode() != keyCode) return;

                    KeyBinding.onKeyPressed(boundKey);

                    if (generation == repeatGeneration
                            && config.isEnabled()
                            && physicallyHeld(client, keyCode)) {
                        scheduleNextRepeat(client, config.getDelayMs());
                    }
                }),
                safeDelay,
                TimeUnit.MILLISECONDS
        );
    }

    public static void delayChanged() {
        if (!initialized) return;

        MinecraftClient client = MinecraftClient.getInstance();

        // Invalidate any repeat scheduled with the old value.
        repeatGeneration++;
        stopPendingRepeatOnly();

        // If the delay changes while actual gameplay is active, restart immediately
        // with the new value. If a GUI is open, the repeat remains paused and
        // resumeRepeatingIfPossible() starts it when the GUI closes.
        if (client.currentScreen == null
                && config.isEnabled()
                && client.player != null
                && client.isWindowFocused()
                && physicallyHeld(client, config.getMacroKeyCode())) {
            macroKeyHeld = true;
            scheduleNextRepeat(client, config.getDelayMs());
        } else if (!config.isEnabled()) {
            macroKeyHeld = false;
        }
    }

    public static void stopRepeatingAndResyncHeldState() {
        MinecraftClient client = MinecraftClient.getInstance();
        if (!initialized) return;
        cancelRepeatAndResync(client);
    }

    public static void resumeRepeatingIfPossible() {
        MinecraftClient client = MinecraftClient.getInstance();
        if (!initialized || client.currentScreen != null || !config.isEnabled()
                || client.player == null || !client.isWindowFocused()) {
            return;
        }

        int keyCode = config.getMacroKeyCode();
        if (!physicallyHeld(client, keyCode)) {
            macroKeyHeld = false;
            stopPendingRepeatOnly();
            return;
        }

        macroKeyHeld = true;
        scheduleNextRepeat(client, config.getDelayMs());
    }

    private static void cancelRepeatAndResync(MinecraftClient client) {
        repeatGeneration++;
        stopPendingRepeatOnly();
        macroKeyHeld = physicallyHeld(client, config.getMacroKeyCode());
        lastMacroKeyCode = config.getMacroKeyCode();
    }

    private static void stopPendingRepeatOnly() {
        if (pendingRepeat != null) {
            pendingRepeat.cancel(false);
            pendingRepeat = null;
        }
    }

    private static boolean physicallyHeld(MinecraftClient client, int keyCode) {
        if (keyCode < 0 || !client.isWindowFocused()) return false;
        return InputUtil.isKeyPressed(client.getWindow(), keyCode);
    }

    private static void shutdownStatic() {
        if (config != null) {
            config.shutdown();
        }
        REPEAT_EXECUTOR.shutdownNow();
    }
}
