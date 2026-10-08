package com.tigerfx.tigermacro.input;

import com.tigerfx.tigermacro.config.MacroConfig;
import com.tigerfx.tigermacro.macro.MacroManager;
import com.tigerfx.tigermacro.screen.MacroSettingsScreen;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.util.InputUtil;
import net.minecraft.client.util.Window;
import org.lwjgl.glfw.GLFW;

public final class InputManager {
    private final MacroConfig config;
    private final MacroManager macroManager;
    private boolean armed;
    private boolean toggleWasDown;
    private boolean menuWasDown;

    public InputManager(MacroConfig config, MacroManager macroManager) {
        this.config = config;
        this.macroManager = macroManager;
    }

    public void tick(MinecraftClient client) {
        syncConfigKeybinds();
        Window window = client.getWindow();
        boolean focused;
        try { focused = GLFW.glfwGetWindowAttrib(window.getHandle(), GLFW.GLFW_FOCUSED) == GLFW.GLFW_TRUE; }
        catch (Throwable ignored) { focused = true; }

        if (!focused) {
            armed = false;
            toggleWasDown = false;
            menuWasDown = false;
            return;
        }

        boolean toggleDown = isPhysicalKeyDown(window.getHandle(), KeyBindingHelper.getBoundKeyOf(MacroKeybinds.macroToggle()));
        boolean menuDown = isPhysicalKeyDown(window.getHandle(), KeyBindingHelper.getBoundKeyOf(MacroKeybinds.openMacroMenu()));

        if (!armed) {
            toggleWasDown = toggleDown;
            menuWasDown = menuDown;
            armed = true;
            return;
        }

        if (toggleDown && !toggleWasDown) macroManager.setEnabled(!macroManager.isEnabled());

        if (menuDown && !menuWasDown && client.currentScreen == null) {
            client.setScreen(new MacroSettingsScreen(null, config, macroManager));
        }

        toggleWasDown = toggleDown;
        menuWasDown = menuDown;
    }

    private void syncConfigKeybinds() { MacroKeybinds.syncToConfig(config); }

    private static boolean isPhysicalKeyDown(long windowHandle, InputUtil.Key key) {
        if (key == null || key.equals(InputUtil.UNKNOWN_KEY) || key.getCategory() != InputUtil.Type.KEYSYM) return false;
        int code = key.getCode();
        if (code < 0) return false;
        return GLFW.glfwGetKey(windowHandle, code) == GLFW.GLFW_PRESS;
    }
}