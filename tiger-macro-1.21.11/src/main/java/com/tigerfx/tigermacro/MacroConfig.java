package com.tigerfx.tigermacro;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.fabricmc.loader.api.FabricLoader;

import java.io.Reader;
import java.io.Writer;
import java.nio.file.Files;
import java.nio.file.Path;

/** Persistent settings stored in config/tiger_macro.json. */
public final class MacroConfig {
    public static final int MIN_DELAY_MS = 10;
    public static final int MAX_DELAY_MS = 500;
    public static final int DEFAULT_DELAY_MS = 100;

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    private int delayMs = DEFAULT_DELAY_MS;
    private boolean debug = false;

    public static MacroConfig load() {
        MacroConfig config = new MacroConfig();
        Path path = configPath();
        if (!Files.exists(path)) {
            config.save();
            return config;
        }

        try (Reader reader = Files.newBufferedReader(path)) {
            JsonElement parsed = JsonParser.parseReader(reader);
            if (!parsed.isJsonObject()) {
                throw new IllegalArgumentException("Root JSON value is not an object");
            }

            JsonObject root = parsed.getAsJsonObject();
            if (root.has("delayMs") && root.get("delayMs").isJsonPrimitive()) {
                config.delayMs = root.get("delayMs").getAsInt();
            }
            if (root.has("debug") && root.get("debug").isJsonPrimitive()) {
                config.debug = root.get("debug").getAsBoolean();
            }
            config.clamp();
        } catch (Exception exception) {
            TigerMacroClient.LOGGER.warn("Could not load Tiger Macro config; using safe defaults.", exception);
            config.delayMs = DEFAULT_DELAY_MS;
            config.debug = false;
            config.save();
        }

        return config;
    }

    public void save() {
        clamp();
        try {
            Path path = configPath();
            Files.createDirectories(path.getParent());
            JsonObject root = new JsonObject();
            root.addProperty("delayMs", delayMs);
            root.addProperty("debug", debug);

            try (Writer writer = Files.newBufferedWriter(path)) {
                GSON.toJson(root, writer);
            }
        } catch (Exception exception) {
            TigerMacroClient.LOGGER.error("Could not save Tiger Macro config.", exception);
        }
    }

    public int getDelayMs() {
        return delayMs;
    }

    public void setDelayMs(int delayMs) {
        int old = this.delayMs;
        this.delayMs = clampDelay(delayMs);
        if (old != this.delayMs && debug) {
            TigerMacroClient.LOGGER.info("[Macro] Delay: {}ms", this.delayMs);
        }
    }

    public boolean isDebug() {
        return debug;
    }

    public void setDebug(boolean debug) {
        this.debug = debug;
    }

    public long getDelayNanos() {
        return (long) delayMs * 1_000_000L;
    }

    private static Path configPath() {
        return FabricLoader.getInstance().getConfigDir().resolve("tiger_macro.json");
    }

    public static int clampDelay(int delayMs) {
        return Math.max(MIN_DELAY_MS, Math.min(MAX_DELAY_MS, delayMs));
    }

    private void clamp() {
        delayMs = clampDelay(delayMs);
    }
}
