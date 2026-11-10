package com.tigerfx.tigermacro;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.mojang.blaze3d.platform.InputConstants;
import net.fabricmc.loader.api.FabricLoader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;

public final class MacroConfig {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Path FILE = FabricLoader.getInstance().getConfigDir().resolve("tiger-macro.json");
    private static MacroConfig current = new MacroConfig();
    public int intervalMs = 1;
    public int repeatDelayMs = 0;
    public boolean enabled = false;
    public int targetKey = InputConstants.KEY_SPACE;
    public int inputSchema = 3;

    public static synchronized MacroConfig get() { return current; }
    public static int clamp(int n, int min, int max) { return Math.min(max, Math.max(min, n)); }

    public static synchronized void load() {
        try {
            if (Files.exists(FILE)) {
                String jsonText = Files.readString(FILE, StandardCharsets.UTF_8);
                JsonObject json = JsonParser.parseString(jsonText).getAsJsonObject();
                // Missing inputSchema means this file was created by 1.21.11 (GLFW).
                // Gson initializes absent fields from our Java defaults, so checking
                // only the deserialized inputSchema used to skip this conversion.
                boolean legacyGlfw = !json.has("inputSchema");
                MacroConfig loaded = GSON.fromJson(json, MacroConfig.class);
                if (loaded != null) current = loaded;
                // Repair files saved by our first 26.3 port: it wrote schema=2
                // without migrating old GLFW SPACE (32). SDL SPACE is a different key.
                boolean brokenPortSpace = current.inputSchema == 2 && current.targetKey == 32;
                if (legacyGlfw || current.inputSchema < 2 || brokenPortSpace) {
                    current.targetKey = oldGlfwToSdl(current.targetKey);
                }
                current.inputSchema = 3;
            }
        } catch (Exception ex) {
            System.err.println("[TigerMacro] Could not load settings: " + ex.getMessage());
        }
        current.intervalMs = clamp(current.intervalMs, 1, 500);
        current.repeatDelayMs = clamp(current.repeatDelayMs, 0, 1000);
        if (current.targetKey < 1) current.targetKey = InputConstants.KEY_SPACE;
        save();
    }

    private static int oldGlfwToSdl(int k) {
        if (k == 32) return InputConstants.KEY_SPACE;
        if (k >= 65 && k <= 90) return InputConstants.KEY_A + (k - 65);
        if (k >= 49 && k <= 57) return InputConstants.KEY_1 + (k - 49);
        if (k == 48) return InputConstants.KEY_0;
        if (k == 257 || k == 335) return InputConstants.KEY_RETURN;
        if (k == 256) return InputConstants.KEY_ESCAPE;
        if (k == 258) return InputConstants.KEY_TAB;
        if (k == 340) return InputConstants.KEY_LSHIFT;
        if (k == 344) return InputConstants.KEY_RSHIFT;
        return InputConstants.KEY_SPACE;
    }

    public static synchronized void save() {
        try {
            Files.createDirectories(FILE.getParent());
            Files.writeString(FILE, GSON.toJson(current), StandardCharsets.UTF_8);
        } catch (Exception ex) {
            System.err.println("[TigerMacro] Could not save settings: " + ex.getMessage());
        }
    }
}
