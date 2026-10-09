package com.tigerfx.tigermacro;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;
import org.lwjgl.glfw.GLFW;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/** Persistent user settings for Tiger Macro. */
public final class MacroConfig {
    private static final Logger LOGGER = LoggerFactory.getLogger("Tiger Macro");
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Path FILE = FabricLoader.getInstance().getConfigDir().resolve("tiger-macro.json");
    private static MacroConfig current = new MacroConfig();

    public int intervalMs = 1;
    public int repeatDelayMs = 0;
    public boolean enabled = false;
    public int targetKey = GLFW.GLFW_KEY_SPACE;

    private MacroConfig() {
    }

    public static synchronized MacroConfig get() {
        return current;
    }

    public static synchronized void load() {
        try {
            if (Files.exists(FILE)) {
                MacroConfig loaded = GSON.fromJson(Files.readString(FILE), MacroConfig.class);
                if (loaded != null) {
                    current = loaded;
                }
            }
        } catch (Exception e) {
            LOGGER.warn("Could not read Tiger Macro settings; using safe defaults.", e);
            current = new MacroConfig();
        }
        current.intervalMs = clamp(current.intervalMs, 1, 500);
        current.repeatDelayMs = clamp(current.repeatDelayMs, 0, 1000);
        if (current.targetKey <= 0) {
            current.targetKey = GLFW.GLFW_KEY_SPACE;
        }
        save();
    }

    public static synchronized void save() {
        try {
            Files.createDirectories(FILE.getParent());
            Files.writeString(FILE, GSON.toJson(current));
        } catch (IOException e) {
            LOGGER.error("Could not save Tiger Macro settings to {}", FILE, e);
        }
    }

    public static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }
}
