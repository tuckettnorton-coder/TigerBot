package com.tigerfx.tigermacro;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.Click;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.gui.widget.TextFieldWidget;
import net.minecraft.client.input.KeyInput;
import net.minecraft.text.Text;
import org.lwjgl.glfw.GLFW;

import java.util.ArrayList;
import java.util.List;

public final class MacroPanelScreen extends Screen {
    private final List<TextFieldWidget> fields = new ArrayList<>();
    private final List<ButtonWidget> keyButtons = new ArrayList<>();
    private final List<ButtonWidget> mouseButtons = new ArrayList<>();
    private TextFieldWidget autoMessageField;
    private TextFieldWidget intervalField;
    private ButtonWidget autoToggleButton;
    private int waitingIndex = -1;
    private String waitingType = "key";

    public MacroPanelScreen() {
        super(Text.literal("Tiger Message Macro"));
    }

    @Override
    protected void init() {
        fields.clear();
        keyButtons.clear();
        mouseButtons.clear();

        int left = Math.max(12, (width - 700) / 2);
        int top = 68;

        autoMessageField = new TextFieldWidget(textRenderer, left, 42, 310, 20, Text.literal("Auto-repeat message"));
        autoMessageField.setMaxLength(256);
        autoMessageField.setText(TigerMacroClient.config().autoRepeatMessage == null
                ? "" : TigerMacroClient.config().autoRepeatMessage);
        addDrawableChild(autoMessageField);

        intervalField = new TextFieldWidget(textRenderer, left + 318, 42, 72, 20, Text.literal("Interval ms"));
        intervalField.setMaxLength(6);
        intervalField.setText(Integer.toString(MacroConfig.clamp(
                TigerMacroClient.config().autoRepeatIntervalMs, 250, 60000)));
        addDrawableChild(intervalField);

        autoToggleButton = ButtonWidget.builder(autoToggleLabel(), b -> {
            saveAutoSettings();
            TigerMacroClient.config().autoRepeatEnabled = !TigerMacroClient.config().autoRepeatEnabled;
            TigerMacroClient.save();
            b.setMessage(autoToggleLabel());
        }).dimensions(left + 398, 42, 120, 20).build();
        addDrawableChild(autoToggleButton);

        for (int i = 0; i < TigerMacroClient.config().actions.size(); i++) {
            final int idx = i;
            MacroConfig.Action action = TigerMacroClient.config().actions.get(i);
            int y = top + i * 33;

            TextFieldWidget field = new TextFieldWidget(textRenderer, left, y, 255, 20,
                    Text.literal(action.name == null ? "Message " + (i + 1) : action.name));
            field.setMaxLength(256);
            field.setText(action.message == null ? "" : action.message);
            fields.add(field);
            addDrawableChild(field);

            ButtonWidget send = ButtonWidget.builder(Text.literal("Send"), b -> {
                saveFields();
                TigerMacroClient.sendMessage(TigerMacroClient.config().actions.get(idx).message);
            }).dimensions(left + 262, y, 55, 20).build();
            addDrawableChild(send);

            ButtonWidget key = ButtonWidget.builder(Text.literal(keyLabel(action)),
                    b -> { waitingIndex = idx; waitingType = "key"; })
                    .dimensions(left + 324, y, 110, 20).build();

            ButtonWidget mouse = ButtonWidget.builder(Text.literal(mouseLabel(action)),
                    b -> { waitingIndex = idx; waitingType = "mouse"; })
                    .dimensions(left + 441, y, 110, 20).build();

            keyButtons.add(key);
            mouseButtons.add(mouse);
            addDrawableChild(key);
            addDrawableChild(mouse);
        }

        int buttonY = top + TigerMacroClient.config().actions.size() * 33 + 12;
        addDrawableChild(ButtonWidget.builder(Text.literal("Save"), b -> {
            saveFields();
            close();
        }).dimensions(width / 2 - 105, buttonY, 100, 22).build());

        addDrawableChild(ButtonWidget.builder(Text.literal("Cancel"), b -> close())
                .dimensions(width / 2 + 5, buttonY, 100, 22).build());
    }

    private Text autoToggleLabel() {
        return Text.literal("Auto: " + (TigerMacroClient.config().autoRepeatEnabled ? "ON" : "OFF"));
    }

    private void saveAutoSettings() {
        if (autoMessageField != null) {
            TigerMacroClient.config().autoRepeatMessage = autoMessageField.getText();
        }
        if (intervalField != null) {
            try {
                int interval = Integer.parseInt(intervalField.getText().trim());
                TigerMacroClient.config().autoRepeatIntervalMs = MacroConfig.clamp(interval, 250, 60000);
            } catch (NumberFormatException ignored) {
                TigerMacroClient.config().autoRepeatIntervalMs = 1000;
            }
        }
    }

    private static String keyLabel(MacroConfig.Action action) {
        if (!"key".equals(action.triggerType) || action.triggerCode <= 0) return "Bind key";

        String name = GLFW.glfwGetKeyName(action.triggerCode, 0);
        if (name == null) {
            name = switch (action.triggerCode) {
                case GLFW.GLFW_KEY_F1 -> "F1";
                case GLFW.GLFW_KEY_F2 -> "F2";
                case GLFW.GLFW_KEY_F3 -> "F3";
                case GLFW.GLFW_KEY_F4 -> "F4";
                case GLFW.GLFW_KEY_F5 -> "F5";
                case GLFW.GLFW_KEY_F6 -> "F6";
                case GLFW.GLFW_KEY_F7 -> "F7";
                case GLFW.GLFW_KEY_F8 -> "F8";
                case GLFW.GLFW_KEY_F9 -> "F9";
                case GLFW.GLFW_KEY_F10 -> "F10";
                case GLFW.GLFW_KEY_F11 -> "F11";
                case GLFW.GLFW_KEY_F12 -> "F12";
                case GLFW.GLFW_KEY_SPACE -> "Space";
                case GLFW.GLFW_KEY_LEFT_SHIFT -> "Left Shift";
                case GLFW.GLFW_KEY_RIGHT_SHIFT -> "Right Shift";
                case GLFW.GLFW_KEY_LEFT_CONTROL -> "Left Ctrl";
                case GLFW.GLFW_KEY_RIGHT_CONTROL -> "Right Ctrl";
                case GLFW.GLFW_KEY_TAB -> "Tab";
                default -> "Key " + action.triggerCode;
            };
        }
        return "Key: " + name;
    }

    private static String mouseLabel(MacroConfig.Action action) {
        return "mouse".equals(action.triggerType) ? "Mouse: " + (action.triggerCode + 1) : "Bind mouse";
    }

    private void saveFields() {
        MacroConfig config = TigerMacroClient.config();
        for (int i = 0; i < fields.size() && i < config.actions.size(); i++) {
            config.actions.get(i).message = fields.get(i).getText();
        }
        saveAutoSettings();
        TigerMacroClient.save();
    }

    @Override
    public boolean keyPressed(KeyInput input) {
        int keyCode = input.key();

        if (waitingIndex >= 0 && keyCode == GLFW.GLFW_KEY_ESCAPE) {
            waitingIndex = -1;
            return true;
        }

        if (waitingIndex >= 0 && waitingType.equals("key")) {
            MacroConfig.Action action = TigerMacroClient.config().actions.get(waitingIndex);
            action.triggerType = "key";
            action.triggerCode = keyCode;
            waitingIndex = -1;
            refreshLabels();
            return true;
        }

        if (keyCode == GLFW.GLFW_KEY_ESCAPE) {
            saveFields();
            close();
            return true;
        }
        return super.keyPressed(input);
    }

    @Override
    public boolean mouseClicked(Click click, boolean doubled) {
        if (waitingIndex >= 0 && waitingType.equals("mouse")) {
            MacroConfig.Action action = TigerMacroClient.config().actions.get(waitingIndex);
            action.triggerType = "mouse";
            action.triggerCode = click.button();
            waitingIndex = -1;
            refreshLabels();
            return true;
        }
        return super.mouseClicked(click, doubled);
    }

    private void refreshLabels() {
        for (int i = 0; i < keyButtons.size(); i++) {
            MacroConfig.Action action = TigerMacroClient.config().actions.get(i);
            keyButtons.get(i).setMessage(Text.literal(keyLabel(action)));
            mouseButtons.get(i).setMessage(Text.literal(mouseLabel(action)));
        }
    }

    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float delta) {
        context.fill(0, 0, width, height, 0xC0101010);
        context.drawCenteredTextWithShadow(textRenderer, title, width / 2, 18, 0xFFFFFF);
        int left = Math.max(12, (width - 700) / 2);
        context.drawTextWithShadow(textRenderer,
                "Edit each message; Send runs it now. Bind a key or mouse button to trigger it.",
                left, 29, 0xAAAAAA);
        context.drawTextWithShadow(textRenderer,
                "Auto-repeat sends its custom message until Auto is turned OFF. Minimum interval: 250 ms.",
                left, height - 34, 0xAAAAAA);
        if (waitingIndex >= 0) {
            context.drawCenteredTextWithShadow(textRenderer,
                    "Press a " + waitingType + " input to bind (Esc cancels)",
                    width / 2, height - 18, 0xFFFF55);
        }
        super.render(context, mouseX, mouseY, delta);
    }

    @Override
    public void close() {
        MinecraftClient.getInstance().setScreen(null);
    }
}
