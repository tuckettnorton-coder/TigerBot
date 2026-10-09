package com.tigerfx.tigermacro;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.AbstractSliderButton;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.network.chat.Component;
import org.lwjgl.glfw.GLFW;

import java.util.Locale;

public final class MacroConfigScreen extends Screen {
    private final Screen parent;
    private Button toggleButton;
    private Button targetKeyButton;
    private boolean capturingTargetKey;

    public MacroConfigScreen(Screen parent) {
        super(Component.literal("Tiger Macro Settings"));
        this.parent = parent;
    }

    @Override
    protected void init() {
        int centerX = this.width / 2;
        int centerY = this.height / 2;

        toggleButton = this.addRenderableWidget(Button.builder(toggleText(), button -> {
            MacroController.setEnabled(!MacroConfig.get().enabled);
            button.setMessage(toggleText());
        }).bounds(centerX - 100, centerY - 40, 200, 20).build());

        this.addRenderableWidget(new IntervalSlider(
                centerX - 125, centerY - 8, 250, 20, MacroConfig.get().intervalMs
        ));

        targetKeyButton = this.addRenderableWidget(Button.builder(targetKeyText(), button -> {
            capturingTargetKey = true;
            button.setMessage(Component.literal("Press a key (Esc cancels)..."));
        }).bounds(centerX - 100, centerY + 24, 200, 20).build());

        this.addRenderableWidget(Button.builder(Component.literal("Close"), button -> onClose())
                .bounds(centerX - 100, centerY + 62, 200, 20).build());
    }

    @Override
    public void tick() {
        super.tick();
        if (toggleButton != null) {
            toggleButton.setMessage(toggleText());
        }
    }

    @Override
    public void render(GuiGraphics graphics, int mouseX, int mouseY, float delta) {
        super.render(graphics, mouseX, mouseY, delta);
        graphics.drawCenteredString(this.font, Component.literal("Tiger Macro Settings"), this.width / 2, this.height / 2 - 92, 0xFFFFFF);
        graphics.drawCenteredString(this.font, Component.literal("Repeats only while the chosen key is held in-game."), this.width / 2, this.height / 2 - 68, 0xC8C8C8);
        if (capturingTargetKey) {
            graphics.drawCenteredString(this.font, Component.literal("Press your target key. Escape cancels."), this.width / 2, this.height / 2 + 94, 0xFFFF55);
        }
    }

    @Override
    public boolean keyPressed(KeyEvent keyEvent) {
        if (capturingTargetKey) {
            int key = keyEvent.key();
            if (key == GLFW.GLFW_KEY_ESCAPE) {
                capturingTargetKey = false;
                targetKeyButton.setMessage(targetKeyText());
                return true;
            }
            if (key >= 0 && TigerMacroClient.isUtilityKey(key)) {
                targetKeyButton.setMessage(Component.literal("Choose a different key..."));
                return true;
            }
            if (key >= 0) {
                MacroConfig.get().targetKey = key;
                MacroConfig.save();
                MacroController.configChanged();
                capturingTargetKey = false;
                targetKeyButton.setMessage(targetKeyText());
                return true;
            }
        }
        return super.keyPressed(keyEvent);
    }

    @Override
    public void onClose() {
        Minecraft.getInstance().setScreen(parent);
    }

    @Override
    public boolean isPauseScreen() {
        return false;
    }

    private static Component toggleText() {
        return Component.literal("Macro: " + (MacroConfig.get().enabled ? "ON" : "OFF"));
    }

    private static Component targetKeyText() {
        return Component.literal("Target key: " + keyName(MacroConfig.get().targetKey));
    }

    private static String keyName(int key) {
        if (key == GLFW.GLFW_KEY_SPACE) return "SPACE";
        if (key == GLFW.GLFW_KEY_LEFT_SHIFT) return "LEFT SHIFT";
        if (key == GLFW.GLFW_KEY_RIGHT_SHIFT) return "RIGHT SHIFT";
        if (key == GLFW.GLFW_KEY_LEFT_CONTROL) return "LEFT CTRL";
        if (key == GLFW.GLFW_KEY_RIGHT_CONTROL) return "RIGHT CTRL";
        if (key == GLFW.GLFW_KEY_LEFT_ALT) return "LEFT ALT";
        if (key == GLFW.GLFW_KEY_RIGHT_ALT) return "RIGHT ALT";
        if (key == GLFW.GLFW_KEY_ENTER || key == GLFW.GLFW_KEY_KP_ENTER) return "ENTER";
        if (key == GLFW.GLFW_KEY_TAB) return "TAB";
        if (key == GLFW.GLFW_KEY_BACKSPACE) return "BACKSPACE";
        if (key == GLFW.GLFW_KEY_DELETE) return "DELETE";
        if (key == GLFW.GLFW_KEY_INSERT) return "INSERT";
        if (key == GLFW.GLFW_KEY_UP) return "UP ARROW";
        if (key == GLFW.GLFW_KEY_DOWN) return "DOWN ARROW";
        if (key == GLFW.GLFW_KEY_LEFT) return "LEFT ARROW";
        if (key == GLFW.GLFW_KEY_RIGHT) return "RIGHT ARROW";
        if (key >= GLFW.GLFW_KEY_F1 && key <= GLFW.GLFW_KEY_F25) return "F" + (key - GLFW.GLFW_KEY_F1 + 1);
        String name = GLFW.glfwGetKeyName(key, 0);
        if (name != null && !name.isBlank()) return name.toUpperCase(Locale.ROOT);
        return "KEY " + key;
    }

    private static final class IntervalSlider extends AbstractSliderButton {
        private IntervalSlider(int x, int y, int width, int height, int intervalMs) {
            super(x, y, width, height, Component.empty(), (MacroConfig.clamp(intervalMs, 1, 500) - 1) / 499.0);
            updateMessage();
        }

        private int interval() {
            return MacroConfig.clamp(1 + (int) Math.round(this.value * 499.0), 1, 500);
        }

        @Override
        protected void updateMessage() {
            setMessage(Component.literal("Repeat interval: " + interval() + " ms"));
        }

        @Override
        protected void applyValue() {
            MacroConfig.get().intervalMs = interval();
            MacroConfig.save();
            MacroController.configChanged();
        }
    }
}
