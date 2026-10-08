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

        if (screen != null) {
            // Consume pending menu/toggle presses while a screen is open so a queued
            // keyboard event cannot unexpectedly reopen the menu after closing it.
            while (toggleKey.wasPressed()) {
                // Intentionally consumed; macro controls are handled only in gameplay.
            }
            while (openMenuKey.wasPressed()) {
                // Intentionally consumed while already in a screen.
            }
            macroKeyHeld = physicallyHeld(client, config.getMacroKeyCode());
            return;
        }

        while (toggleKey.wasPressed()) {
            toggleMacro(client);
        }

        while (openMenuKey.wasPressed()) {
            cancelRepeatAndResync(client);
            // Queue the screen change onto the client executor. This avoids changing
            // the active screen in the middle of key-repeat processing.
            client.execute(() -> {
                if (client.currentScreen == null) {
                    client.setScreen(new MacroScreen(null));
                }
            });
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
            // First physical activation remains Minecraft's normal key action.
            // Only the subsequent repeats are scheduled.
            scheduleNextRepeat(client, config.getDelayMs());
        }
    }

    private static void toggleMacro(MinecraftClient client) {
        boolean newState = !config.isEnabled();
        config.setEnabled(newState);
        cancelRepeatAndResync(client);
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
        MinecraftClient client = MinecraftClient.getInstance();
        if (!initialized) return;

        cancelRepeatAndResync(client);
        if (config.isEnabled()
                && client.currentScreen == null
                && client.player != null
                && client.isWindowFocused()
                && physicallyHeld(client, config.getMacroKeyCode())) {
            macroKeyHeld = true;
            scheduleNextRepeat(client, config.getDelayMs());
        }
    }

    public static void stopRepeatingAndResyncHeldState() {
        MinecraftClient client = MinecraftClient.getInstance();
        if (!initialized) return;
        cancelRepeatAndResync(client);
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
