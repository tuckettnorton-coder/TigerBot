package com.tigerfx.tigermacro;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.SliderWidget;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.text.Text;
import org.lwjgl.glfw.GLFW;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Properties;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

public final class TigerMacroClient implements ClientModInitializer {
    private static final int MIN_DELAY_MS = 10;
    private static final int MAX_DELAY_MS = 500;
    private static final int DEFAULT_DELAY_MS = 100;

    private static final int DEFAULT_TOGGLE_KEY = GLFW.GLFW_KEY_F6;
    private static final int DEFAULT_MACRO_KEY = GLFW.GLFW_KEY_SPACE;
    private static final int DEFAULT_MENU_KEY = GLFW.GLFW_KEY_F7;

    private static MacroConfig config;
    private static MacroController controller;
    private static Path configPath;

    private static KeyBinding macroToggle;
    private static KeyBinding macroKey;
    private static KeyBinding openMenu;

    private static boolean inputsArmed;
    private static boolean previousToggleDown;
    private static boolean previousMenuDown;

    @Override
    public void onInitializeClient() {
        MinecraftClient client = MinecraftClient.getInstance();

        configPath = FabricLoader.getInstance()
                .getConfigDir()
                .resolve("tigermacro.properties");

        config = MacroConfig.load(configPath);

        macroToggle = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.tigermacro.macro_toggle",
                InputUtil.Type.KEYSYM,
                config.macroToggleKey,
                KeyBinding.Category.MISC
        ));

        macroKey = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.tigermacro.macro_key",
                InputUtil.Type.KEYSYM,
                config.macroKey,
                KeyBinding.Category.MISC
        ));

        openMenu = KeyBindingHelper.registerKeyBinding(new KeyBinding(
                "key.tigermacro.open_menu",
                InputUtil.Type.KEYSYM,
                config.openMenuKey,
                KeyBinding.Category.MISC
        ));

        macroToggle.setBoundKey(InputUtil.Type.KEYSYM.createFromCode(config.macroToggleKey));
        macroKey.setBoundKey(InputUtil.Type.KEYSYM.createFromCode(config.macroKey));
        openMenu.setBoundKey(InputUtil.Type.KEYSYM.createFromCode(config.openMenuKey));

        controller = new MacroController(client);

        ClientTickEvents.END_CLIENT_TICK.register(TigerMacroClient::clientTick);

        Runtime.getRuntime().addShutdownHook(
                new Thread(controller::shutdown, "TigerMacro-Shutdown")
        );
    }

    private static void clientTick(MinecraftClient client) {
        syncKeybinds();

        boolean gameplay = client.currentScreen == null
                && client.world != null
                && client.player != null
                && isWindowFocused(client);

        if (!gameplay) {
            inputsArmed = false;
            previousToggleDown = false;
            previousMenuDown = false;
            controller.stop();
            return;
        }

        boolean toggleDown = isKeyDown(client, config.macroToggleKey);
        boolean menuDown = isKeyDown(client, config.openMenuKey);
        boolean macroDown = isKeyDown(client, config.macroKey);

        if (!inputsArmed) {
            inputsArmed = true;
            previousToggleDown = toggleDown;
            previousMenuDown = menuDown;
        } else {
            if (toggleDown && !previousToggleDown) {
                controller.setEnabled(!config.enabled);
            }

            if (menuDown && !previousMenuDown) {
                client.setScreen(new MacroMenuScreen(controller));
                previousToggleDown = toggleDown;
                previousMenuDown = menuDown;
                controller.stop();
                return;
            }
        }

        previousToggleDown = toggleDown;
        previousMenuDown = menuDown;

        controller.tick(macroDown);
    }

    private static void syncKeybinds() {
        syncOne(macroToggle, KeySlot.TOGGLE, config.macroToggleKey);
        syncOne(macroKey, KeySlot.MACRO, config.macroKey);
        syncOne(openMenu, KeySlot.MENU, config.openMenuKey);
    }

    private static void syncOne(KeyBinding binding, KeySlot slot, int oldCode) {
        InputUtil.Key key = KeyBindingHelper.getBoundKeyOf(binding);

        if (key.getCategory() != InputUtil.Type.KEYSYM) {
            binding.setBoundKey(InputUtil.Type.KEYSYM.createFromCode(oldCode));
            return;
        }

        int code = key.getCode();
        if (code == oldCode) {
            return;
        }

        switch (slot) {
            case TOGGLE -> config.macroToggleKey = normalizeKeyCode(code);
            case MACRO -> config.macroKey = normalizeKeyCode(code);
            case MENU -> config.openMenuKey = normalizeKeyCode(code);
        }

        saveConfigQuietly();
    }

    private static boolean isKeyDown(MinecraftClient client, int keyCode) {
        return keyCode >= 0
                && GLFW.glfwGetKey(client.getWindow().getHandle(), keyCode) == GLFW.GLFW_PRESS;
    }

    private static boolean isWindowFocused(MinecraftClient client) {
        long handle = client.getWindow().getHandle();
        return handle != 0L
                && GLFW.glfwGetWindowAttrib(handle, GLFW.GLFW_FOCUSED) == GLFW.GLFW_TRUE;
    }

    static void saveConfigQuietly() {
        try {
            config.save(configPath);
        } catch (Throwable ignored) {
        }
    }

    private static int normalizeKeyCode(int code) {
        return Math.max(-1, code);
    }

    private enum KeySlot {
        TOGGLE, MACRO, MENU
    }

    private static final class MacroConfig {
        private boolean enabled = false;
        private int repeatDelayMs = DEFAULT_DELAY_MS;
        private int macroToggleKey = DEFAULT_TOGGLE_KEY;
        private int macroKey = DEFAULT_MACRO_KEY;
        private int openMenuKey = DEFAULT_MENU_KEY;

        static MacroConfig load(Path file) {
            MacroConfig result = new MacroConfig();

            try {
                if (Files.exists(file)) {
                    Properties p = new Properties();
                    try (BufferedReader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
                        p.load(reader);
                    }

                    result.enabled = parseBoolean(p.getProperty("enabled"), result.enabled);
                    result.repeatDelayMs = clampDelay(parseInt(p.getProperty("repeatDelayMs"), result.repeatDelayMs));
                    result.macroToggleKey = normalizeKeyCode(parseInt(p.getProperty("macroToggleKey"), result.macroToggleKey));
                    result.macroKey = normalizeKeyCode(parseInt(p.getProperty("macroKey"), result.macroKey));
                    result.openMenuKey = normalizeKeyCode(parseInt(p.getProperty("openMenuKey"), result.openMenuKey));
                }

                result.save(file);
            } catch (Throwable ignored) {
                try {
                    result.save(file);
                } catch (Throwable ignoredSave) {
                }
            }

            return result;
        }

        synchronized void save(Path file) throws IOException {
            Path parent = file.getParent();
            if (parent != null) {
                Files.createDirectories(parent);
            }

            Properties p = new Properties();
            p.setProperty("enabled", Boolean.toString(enabled));
            p.setProperty("repeatDelayMs", Integer.toString(clampDelay(repeatDelayMs)));
            p.setProperty("macroToggleKey", Integer.toString(normalizeKeyCode(macroToggleKey)));
            p.setProperty("macroKey", Integer.toString(normalizeKeyCode(macroKey)));
            p.setProperty("openMenuKey", Integer.toString(normalizeKeyCode(openMenuKey)));

            Path temp = file.resolveSibling(file.getFileName() + ".tmp");
            try (BufferedWriter writer = Files.newBufferedWriter(temp, StandardCharsets.UTF_8)) {
                p.store(writer, "Tiger Macro client settings");
            }

            try {
                Files.move(temp, file, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } catch (java.nio.file.AtomicMoveNotSupportedException ignored) {
                Files.move(temp, file, StandardCopyOption.REPLACE_EXISTING);
            }
        }

        private static int clampDelay(int value) {
            return Math.max(MIN_DELAY_MS, Math.min(MAX_DELAY_MS, value));
        }

        private static int parseInt(String value, int fallback) {
            try {
                return Integer.parseInt(value);
            } catch (Throwable ignored) {
                return fallback;
            }
        }

        private static boolean parseBoolean(String value, boolean fallback) {
            if ("true".equalsIgnoreCase(value) || "false".equalsIgnoreCase(value)) {
                return Boolean.parseBoolean(value);
            }
            return fallback;
        }
    }

    private static final class MacroMenuScreen extends Screen {
        private final MacroController controller;

        private MacroMenuScreen(MacroController controller) {
            super(Text.literal("Tiger Macro"));
            this.controller = controller;
        }

        @Override
        protected void init() {
            int width = Math.min(320, this.width - 40);
            int x = (this.width - width) / 2;
            int y = this.height / 2 - 10;

            this.addDrawableChild(new DelaySlider(x, y, width, 20, controller.getDelayMs()));
        }

        @Override
        public boolean shouldPause() {
            return false;
        }

        private final class DelaySlider extends SliderWidget {
            private DelaySlider(int x, int y, int width, int height, int delayMs) {
                super(
                        x,
                        y,
                        width,
                        height,
                        Text.literal("Repeat delay: " + delayMs + " ms"),
                        (MacroConfig.clampDelay(delayMs) - MIN_DELAY_MS)
                                / (double) (MAX_DELAY_MS - MIN_DELAY_MS)
                );
            }

            @Override
            protected void updateMessage() {
                this.setMessage(Text.literal("Repeat delay: " + delayFromValue() + " ms"));
            }

            @Override
            protected void applyValue() {
                controller.setDelayMs(delayFromValue());
            }

            private int delayFromValue() {
                return MacroConfig.clampDelay(
                        (int) Math.round(
                                MIN_DELAY_MS + this.value * (MAX_DELAY_MS - MIN_DELAY_MS)
                        )
                );
            }
        }
    }

    private static final class MacroController {
        private final MinecraftClient client;
        private final ScheduledExecutorService scheduler;
        private final Object lock = new Object();

        private ScheduledFuture<?> scheduled;
        private long generation;
        private boolean actionQueued;

        private MacroController(MinecraftClient client) {
            this.client = client;
            this.scheduler = Executors.newSingleThreadScheduledExecutor(task -> {
                Thread thread = new Thread(task, "TigerMacro-Timer");
                thread.setDaemon(true);
                return thread;
            });
        }

        private void tick(boolean macroKeyDown) {
            if (!macroKeyDown || !config.enabled || !gameplayStillValid()) {
                stop();
                return;
            }

            synchronized (lock) {
                if (scheduled == null && !actionQueued) {
                    scheduleLocked(config.repeatDelayMs);
                }
            }
        }

        private void setEnabled(boolean enabled) {
            config.enabled = enabled;
            saveConfigQuietly();
            stop();
        }

        private int getDelayMs() {
            return config.repeatDelayMs;
        }

        private void setDelayMs(int delayMs) {
            int clamped = MacroConfig.clampDelay(delayMs);
            if (clamped == config.repeatDelayMs) {
                return;
            }

            config.repeatDelayMs = clamped;
            saveConfigQuietly();
            stop();
        }

        private void stop() {
            synchronized (lock) {
                generation++;
                if (scheduled != null) {
                    scheduled.cancel(false);
                    scheduled = null;
                }
                actionQueued = false;
            }
        }

        private void scheduleLocked(int delayMs) {
            long token = ++generation;

            scheduled = scheduler.schedule(() -> {
                synchronized (lock) {
                    if (token != generation || !config.enabled) {
                        return;
                    }
                    scheduled = null;
                    actionQueued = true;
                }

                client.execute(() -> runOne(token));
            }, delayMs, TimeUnit.MILLISECONDS);
        }

        private void runOne(long token) {
            synchronized (lock) {
                if (token != generation || !config.enabled || !actionQueued) {
                    actionQueued = false;
                    return;
                }
            }

            if (!gameplayStillValid() || !isKeyDown(client, config.macroKey)) {
                stop();
                return;
            }

            InputUtil.Key key = KeyBindingHelper.getBoundKeyOf(macroKey);
            if (key.getCategory() != InputUtil.Type.KEYSYM || key.getCode() < 0) {
                stop();
                return;
            }

            KeyBinding.onKeyPressed(key);

            synchronized (lock) {
                actionQueued = false;

                if (token == generation
                        && config.enabled
                        && gameplayStillValid()
                        && isKeyDown(client, config.macroKey)) {
                    scheduleLocked(config.repeatDelayMs);
                }
            }
        }

        private boolean gameplayStillValid() {
            return client.currentScreen == null
                    && client.world != null
                    && client.player != null
                    && isWindowFocused(client);
        }

        private void shutdown() {
            stop();
            scheduler.shutdownNow();
            saveConfigQuietly();
        }
    }
}
