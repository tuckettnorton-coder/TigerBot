package com.tigerfx.tigermacro;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

final class MacroConfig {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Path FILE = FabricLoader.getInstance().getConfigDir().resolve("tigermessage.json");

    final List<Action> actions = new ArrayList<>();
    boolean autoRepeatEnabled = false;
    String autoRepeatMessage = "/pay TigerFX_ 300M";
    int autoRepeatIntervalMs = 1000;

    static final class Action {
        String name;
        String message;
        String triggerType = "key";
        int triggerCode;

        Action(String name, String message, String type, int code) {
            this.name = name;
            this.message = message;
            this.triggerType = type;
            this.triggerCode = code;
        }
    }

    static MacroConfig load() {
        try {
            if (Files.exists(FILE)) {
                MacroConfig loaded = GSON.fromJson(Files.readString(FILE), MacroConfig.class);
                if (loaded != null && loaded.actions != null && !loaded.actions.isEmpty()) {
                    if (loaded.autoRepeatMessage == null) loaded.autoRepeatMessage = "/pay TigerFX_ 300M";
                    loaded.autoRepeatIntervalMs = clamp(loaded.autoRepeatIntervalMs, 250, 60000);
                    return loaded;
                }
            }
        } catch (Exception ignored) {
        }

        MacroConfig config = new MacroConfig();
        config.actions.add(new Action("Message 1", "/pay TigerFX_ 300M", "key", org.lwjgl.glfw.GLFW.GLFW_KEY_F6));
        config.actions.add(new Action("Message 2", "", "key", 0));
        config.actions.add(new Action("Message 3", "", "key", 0));
        config.actions.add(new Action("Message 4", "", "key", 0));
        config.actions.add(new Action("Message 5", "", "key", 0));
        config.save();
        return config;
    }

    void save() {
        try {
            Files.createDirectories(FILE.getParent());
            Files.writeString(FILE, GSON.toJson(this));
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }
}
