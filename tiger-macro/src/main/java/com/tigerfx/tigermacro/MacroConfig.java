package com.tigerfx.tigermacro;

import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Properties;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

public final class MacroConfig {
    public static final int MIN_DELAY_MS = 10;
    public static final int MAX_DELAY_MS = 500;
    public static final int DEFAULT_DELAY_MS = 100;
    public static final int DEFAULT_TOGGLE_KEY = 296;
    public static final int DEFAULT_MACRO_KEY = 32;
    public static final int DEFAULT_OPEN_MENU_KEY = 297;

    private static final String FILE_NAME = "tiger-macro.properties";
    private static final long SAVE_DEBOUNCE_MS = 75L;
    private static final ScheduledExecutorService SAVE_EXECUTOR = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread thread = new Thread(r, "Tiger Macro Config Saver");
        thread.setDaemon(true);
        return thread;
    });

    private final Path file;
    private final Object lock = new Object();

    private boolean enabled;
    private int delayMs;
    private int toggleKeyCode;
    private int macroKeyCode;
    private int openMenuKeyCode;
    private ScheduledFuture<?> pendingSave;

    private MacroConfig(Path file) {
        this.file = file;
    }

    public static MacroConfig load() {
        Path file = FabricLoader.getInstance().getConfigDir().resolve(FILE_NAME);
        MacroConfig config = new MacroConfig(file);
        config.readFromDisk();
        return config;
    }

    public Path getFile() {
        return file;
    }

    public boolean isEnabled() {
        synchronized (lock) {
            return enabled;
        }
    }

    public void setEnabled(boolean enabled) {
        synchronized (lock) {
            if (this.enabled == enabled) return;
            this.enabled = enabled;
        }
        requestSave();
    }

    public int getDelayMs() {
        synchronized (lock) {
            return delayMs;
        }
    }

    public void setDelayMs(int delayMs) {
        int clamped = clampDelay(delayMs);
        synchronized (lock) {
            if (this.delayMs == clamped) return;
            this.delayMs = clamped;
        }
        requestSave();
    }

    public int getToggleKeyCode() {
        synchronized (lock) {
            return toggleKeyCode;
        }
    }

    public void setToggleKeyCode(int keyCode) {
        synchronized (lock) {
            if (toggleKeyCode == keyCode) return;
            toggleKeyCode = keyCode;
        }
        requestSave();
    }

    public int getMacroKeyCode() {
        synchronized (lock) {
            return macroKeyCode;
        }
    }

    public void setMacroKeyCode(int keyCode) {
        synchronized (lock) {
            if (macroKeyCode == keyCode) return;
            macroKeyCode = keyCode;
        }
        requestSave();
    }

    public int getOpenMenuKeyCode() {
        synchronized (lock) {
            return openMenuKeyCode;
        }
    }

    public void setOpenMenuKeyCode(int keyCode) {
        synchronized (lock) {
            if (openMenuKeyCode == keyCode) return;
            openMenuKeyCode = keyCode;
        }
        requestSave();
    }

    public Snapshot snapshot() {
        synchronized (lock) {
            return new Snapshot(enabled, delayMs, toggleKeyCode, macroKeyCode, openMenuKeyCode);
        }
    }

    public void requestSave() {
        synchronized (lock) {
            if (pendingSave != null) pendingSave.cancel(false);
            pendingSave = SAVE_EXECUTOR.schedule(this::saveNow, SAVE_DEBOUNCE_MS, TimeUnit.MILLISECONDS);
        }
    }

    public void saveNowAsync() {
        synchronized (lock) {
            if (pendingSave != null) {
                pendingSave.cancel(false);
                pendingSave = null;
            }
        }
        SAVE_EXECUTOR.execute(this::saveNow);
    }

    public void saveNow() {
        Snapshot snapshot = snapshot();
        try {
            Files.createDirectories(file.getParent());
            Path temp = file.resolveSibling(file.getFileName() + ".tmp");

            Properties properties = new Properties();
            properties.setProperty("enabled", Boolean.toString(snapshot.enabled()));
            properties.setProperty("delay_ms", Integer.toString(snapshot.delayMs()));
            properties.setProperty("toggle_key_code", Integer.toString(snapshot.toggleKeyCode()));
            properties.setProperty("macro_key_code", Integer.toString(snapshot.macroKeyCode()));
            properties.setProperty("open_menu_key_code", Integer.toString(snapshot.openMenuKeyCode()));

            try (OutputStream output = Files.newOutputStream(temp)) {
                properties.store(output, "Tiger Macro client configuration");
            }

            try {
                Files.move(temp, file, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } catch (AtomicMoveNotSupportedException ignored) {
                Files.move(temp, file, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException exception) {
            exception.printStackTrace();
        }
    }

    public void shutdown() {
        saveNow();
        synchronized (lock) {
            if (pendingSave != null) {
                pendingSave.cancel(false);
                pendingSave = null;
            }
        }
        SAVE_EXECUTOR.shutdown();
    }

    private void readFromDisk() {
        Snapshot defaults = new Snapshot(false, DEFAULT_DELAY_MS, DEFAULT_TOGGLE_KEY, DEFAULT_MACRO_KEY, DEFAULT_OPEN_MENU_KEY);
        Snapshot loaded = defaults;
        boolean rewrite = false;

        if (Files.exists(file)) {
            Properties properties = new Properties();
            try (InputStream input = Files.newInputStream(file)) {
                properties.load(input);
                boolean enabledValue = parseBoolean(properties, "enabled", defaults.enabled());
                int delayValue = parseInt(properties, "delay_ms", defaults.delayMs());
                int toggleValue = parseInt(properties, "toggle_key_code", defaults.toggleKeyCode());
                int macroValue = parseInt(properties, "macro_key_code", defaults.macroKeyCode());
                int openValue = parseInt(properties, "open_menu_key_code", defaults.openMenuKeyCode());

                int clampedDelay = clampDelay(delayValue);
                loaded = new Snapshot(enabledValue, clampedDelay, toggleValue, macroValue, openValue);
                rewrite = clampedDelay != delayValue;
            } catch (IOException | RuntimeException exception) {
                exception.printStackTrace();
                loaded = defaults;
                rewrite = true;
            }
        } else {
            rewrite = true;
        }

        synchronized (lock) {
            enabled = loaded.enabled();
            delayMs = loaded.delayMs();
            toggleKeyCode = loaded.toggleKeyCode();
            macroKeyCode = loaded.macroKeyCode();
            openMenuKeyCode = loaded.openMenuKeyCode();
        }

        if (rewrite) saveNow();
    }

    private static boolean parseBoolean(Properties properties, String key, boolean fallback) {
        String value = properties.getProperty(key);
        return value == null ? fallback : Boolean.parseBoolean(value.trim());
    }

    private static int parseInt(Properties properties, String key, int fallback) {
        String value = properties.getProperty(key);
        if (value == null) return fallback;
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    public static int clampDelay(int value) {
        return Math.max(MIN_DELAY_MS, Math.min(MAX_DELAY_MS, value));
    }

    public record Snapshot(boolean enabled, int delayMs, int toggleKeyCode, int macroKeyCode, int openMenuKeyCode) {}
}
