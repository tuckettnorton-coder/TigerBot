package com.tigerfx.tigermacro.input;

import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import org.lwjgl.glfw.GLFW;

public final class MacroKeybinds {
    private static final InputUtil.Key DEFAULT_MACRO_KEY = InputUtil.Type.KEYSYM.createFromCode(GLFW.GLFW_KEY_SPACE);
    private static final InputUtil.Key DEFAULT_TOGGLE_KEY = InputUtil.Type.KEYSYM.createFromCode(GLFW.GLFW_KEY_F7);
    private static final InputUtil.Key DEFAULT_MENU_KEY = InputUtil.Type.KEYSYM.createFromCode(GLFW.GLFW_KEY_F8);

    private static final KeyBinding MACRO_KEY = KeyBindingHelper.registerKeyBinding(
            new KeyBinding("key.tigermacro.macro_key", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_SPACE, KeyBinding.Category.MISC)
    );
    private static final KeyBinding MACRO_TOGGLE = KeyBindingHelper.registerKeyBinding(
            new KeyBinding("key.tigermacro.macro_toggle", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_F7, KeyBinding.Category.MISC)
    );
    private static final KeyBinding OPEN_MACRO_MENU = KeyBindingHelper.registerKeyBinding(
            new KeyBinding("key.tigermacro.open_macro_menu", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_F8, KeyBinding.Category.MISC)
    );

    private MacroKeybinds() {}

    public static KeyBinding macroKey() { return MACRO_KEY; }
    public static KeyBinding macroToggle() { return MACRO_TOGGLE; }
    public static KeyBinding openMacroMenu() { return OPEN_MACRO_MENU; }

    public static void loadFromConfig(com.tigerfx.tigermacro.config.MacroConfig config) {
        MACRO_KEY.setBoundKey(parseKey(config.getMacroKey(), DEFAULT_MACRO_KEY));
        MACRO_TOGGLE.setBoundKey(parseKey(config.getMacroToggle(), DEFAULT_TOGGLE_KEY));
        OPEN_MACRO_MENU.setBoundKey(parseKey(config.getOpenMacroMenu(), DEFAULT_MENU_KEY));
    }

    public static boolean syncToConfig(com.tigerfx.tigermacro.config.MacroConfig config) {
        String macroKey = KeyBindingHelper.getBoundKeyOf(MACRO_KEY).getTranslationKey();
        String macroToggle = KeyBindingHelper.getBoundKeyOf(MACRO_TOGGLE).getTranslationKey();
        String openMenu = KeyBindingHelper.getBoundKeyOf(OPEN_MACRO_MENU).getTranslationKey();
        boolean changed = !macroKey.equals(config.getMacroKey()) || !macroToggle.equals(config.getMacroToggle()) || !openMenu.equals(config.getOpenMacroMenu());
        if (changed) {
            config.setMacroKey(macroKey);
            config.setMacroToggle(macroToggle);
            config.setOpenMacroMenu(openMenu);
            config.save();
        }
        return changed;
    }

    private static InputUtil.Key parseKey(String translationKey, InputUtil.Key fallback) {
        try {
            InputUtil.Key key = InputUtil.fromTranslationKey(translationKey);
            return key == null || key.equals(InputUtil.UNKNOWN_KEY) ? fallback : key;
        } catch (Exception ignored) {
            return fallback;
        }
    }
}