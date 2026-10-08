package com.tigerfx.tigermacro.config;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.util.InputUtil;

import java.io.IOException;
import java.io.Reader;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

public final class MacroConfig {
    public static final int MIN_DELAY_MS = 10;
    public static final int MAX_DELAY_MS = 500;
    public static final int DEFAULT_DELAY_MS = 100;

    private static final String DEFAULT_MACRO_KEY = InputUtil.Type.KEYSYM.createFromCode(InputUtil.GLFW_KEY_SPACE).getTranslationKey();
    private static final String DEFAULT_TOGGLE_KEY = InputUtil.Type.KEYSYM.createFromCode(InputUtil.GLFW_KEY_F7).getTranslationKey();
    private static final String DEFAULT_MENU_KEY = InputUtil.Type.KEYSYM.createFromCode(InputUtil.GLFW_KEY_F8).getTranslationKey();

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Path FILE = FabricLoader.getInstance().getConfigDir().resolve("tigermacro.json");

    private String macroKey = DEFAULT_MACRO_KEY;
    private String macroToggle = DEFAULT_TOGGLE_KEY;
    private String openMacroMenu = DEFAULT_MENU_KEY;
    private int delayMs = DEFAULT_DELAY_MS;
    private boolean enabled = false;

    private MacroConfig() {
    }

    public static MacroConfig defaults() {
        return new MacroConfig();
    }

    public static MacroConfig load() {
        MacroConfig config = defaults();

        if (!Files.exists(FILE)) {
            config.save();
            return config;
        }

        boolean repaired = false;
        try (Reader reader = Files.newBufferedReader(FILE, StandardCharsets.UTF_8)) {
            JsonElement rootElement = JsonParser.parseReader(reader);
            if (!rootElement.isJsonObject()) {
                config.save();
                return config;
            }

            JsonObject root = rootElement.getAsJsonObject();

            ParsedString macroKey = readKey(root, "macroKey", DEFAULT_MACRO_KEY);
            ParsedString macroToggle = readKey(root, "macroToggle", DEFAULT_TOGGLE_KEY);
            ParsedString openMacroMenu = readKey(root, "openMacroMenu", DEFAULT_MENU_KEY);
            ParsedInt delay = readDelay(root, "delayMs", DEFAULT_DELAY_MS);
            ParsedBoolean enabled = readBoolean(root, "enabled", false);

            config.macroKey = macroKey.value;
            config.macroToggle = macroToggle.value;
            config.openMacroMenu = openMacroMenu.value;
            config.delayMs = delay.value;
            config.enabled = enabled.value;

            repaired = macroKey.repaired || macroToggle.repaired || openMacroMenu.repaired || delay.repaired || enabled.repaired;
        } catch (Exception ignored) {
            config = defaults();
            repaired = true;
        }

        if (repaired) {
            config.save();
        }
        return config;
    }

    public synchronized void save() {
        try {
            Files.createDirectories(FILE.getParent());
            JsonObject root = new JsonObject();
            root.addProperty("macroKey", sanitizeKeyString(macroKey, DEFAULT_MACRO_KEY));
            root.addProperty("macroToggle", sanitizeKeyString(macroToggle, DEFAULT_TOGGLE_KEY));
            root.addProperty("openMacroMenu", sanitizeKeyString(openMacroMenu, DEFAULT_MENU_KEY));
            root.addProperty("delayMs", clampDelay(delayMs));
            root.addProperty("enabled", enabled);

            try (Writer writer = Files.newBufferedWriter(FILE, StandardCharsets.UTF_8)) {
                GSON.toJson(root, writer);
            }
        } catch (IOException ignored) {
        }
    }

    public synchronized String getMacroKey() { return macroKey; }
    public synchronized void setMacroKey(String macroKey) { this.macroKey = sanitizeKeyString(macroKey, DEFAULT_MACRO_KEY); }
    public synchronized String getMacroToggle() { return macroToggle; }
    public synchronized void setMacroToggle(String macroToggle) { this.macroToggle = sanitizeKeyString(macroToggle, DEFAULT_TOGGLE_KEY); }
    public synchronized String getOpenMacroMenu() { return openMacroMenu; }
    public synchronized void setOpenMacroMenu(String openMacroMenu) { this.openMacroMenu = sanitizeKeyString(openMacroMenu, DEFAULT_MENU_KEY); }
    public synchronized int getDelayMs() { return delayMs; }
    public synchronized void setDelayMs(int delayMs) { this.delayMs = clampDelay(delayMs); }
    public synchronized boolean isEnabled() { return enabled; }
    public synchronized void setEnabled(boolean enabled) { this.enabled = enabled; }

    public static int clampDelay(int value) {
        if (value < MIN_DELAY_MS || value > MAX_DELAY_MS) return DEFAULT_DELAY_MS;
        return value;
    }

    private static String sanitizeKeyString(String value, String fallback) {
        if (value == null || value.isBlank()) return fallback;
        try {
            InputUtil.Key key = InputUtil.fromTranslationKey(value);
            if (key == null || key.equals(InputUtil.UNKNOWN_KEY)) return fallback;
            return key.getTranslationKey();
        } catch (Exception ignored) {
            return fallback;
        }
    }

    private static ParsedString readKey(JsonObject root, String field, String fallback) {
        if (!root.has(field) || !root.get(field).isJsonPrimitive() || !root.get(field).getAsJsonPrimitive().isString())
            return new ParsedString(fallback, true);
        try {
            String raw = root.get(field).getAsString();
            String sanitized = sanitizeKeyString(raw, fallback);
            return new ParsedString(sanitized, !sanitized.equals(raw));
        } catch (Exception ignored) {
            return new ParsedString(fallback, true);
        }
    }

    private static ParsedInt readDelay(JsonObject root, String field, int fallback) {
        if (!root.has(field) || !root.get(field).isJsonPrimitive() || !root.get(field).getAsJsonPrimitive().isNumber())
            return new ParsedInt(fallback, true);
        try {
            double raw = root.get(field).getAsDouble();
            if (!Double.isFinite(raw) || raw != Math.rint(raw)) return new ParsedInt(fallback, true);
            int value = root.get(field).getAsInt();
            int clamped = clampDelay(value);
            return new ParsedInt(clamped, value != clamped);
        } catch (Exception ignored) {
            return new ParsedInt(fallback, true);
        }
    }

    private static ParsedBoolean readBoolean(JsonObject root, String field, boolean fallback) {
        if (!root.has(field) || !root.get(field).isJsonPrimitive() || !root.get(field).getAsJsonPrimitive().isBoolean())
            return new ParsedBoolean(fallback, true);
        try { return new ParsedBoolean(root.get(field).getAsBoolean(), false); }
        catch (Exception ignored) { return new ParsedBoolean(fallback, true); }
    }

    private record ParsedString(String value, boolean repaired) {}
    private record ParsedInt(int value, boolean repaired) {}
    private record ParsedBoolean(boolean value, boolean repaired) {}
}