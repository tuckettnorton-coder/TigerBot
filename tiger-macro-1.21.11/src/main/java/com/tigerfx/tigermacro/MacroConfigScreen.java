package com.tigerfx.tigermacro;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.gui.widget.SliderWidget;
import net.minecraft.client.input.KeyInput;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.text.Text;
import org.lwjgl.glfw.GLFW;

/** Clean in-game configuration UI. */
public final class MacroConfigScreen extends Screen {
    private final MinecraftClient client;
    private final Screen parent;

    private final InputUtil.Key originalPlacementKey;
    private final InputUtil.Key originalGlobalKey;
    private final InputUtil.Key originalSettingsKey;
    private final int originalDelayMs;

    private MacroKeybinds.BindingType capturing;
    private String errorMessage;
    private DelaySlider delaySlider;
    private ButtonWidget placementButton;
    private ButtonWidget globalButton;
    private ButtonWidget settingsButton;

    public MacroConfigScreen(MinecraftClient client, Screen parent) {
        super(Text.translatable("screen.tiger_macro.title"));
        this.client = client;
        this.parent = parent;
        this.originalPlacementKey = MacroKeybinds.getBoundKey(TigerMacroClient.TOGGLE_MACRO_KEY);
        this.originalGlobalKey = MacroKeybinds.getBoundKey(TigerMacroClient.TOGGLE_GLOBAL_KEY);
        this.originalSettingsKey = MacroKeybinds.getBoundKey(TigerMacroClient.OPEN_CONFIG_KEY);
        this.originalDelayMs = TigerMacroClient.getConfig().getDelayMs();
    }

    @Override
    protected void init() {
        clearChildren();
        int center = width / 2;
        int fieldWidth = Math.min(360, width - 40);

        placementButton = addDrawableChild(ButtonWidget.builder(
                        bindingText("screen.tiger_macro.toggle_key", TigerMacroClient.TOGGLE_MACRO_KEY),
                        button -> startCapture(MacroKeybinds.BindingType.PLACEMENT))
                .dimensions(center - fieldWidth / 2, 78, fieldWidth, 20)
                .build());

        globalButton = addDrawableChild(ButtonWidget.builder(
                        bindingText("screen.tiger_macro.global_key", TigerMacroClient.TOGGLE_GLOBAL_KEY),
                        button -> startCapture(MacroKeybinds.BindingType.GLOBAL))
                .dimensions(center - fieldWidth / 2, 104, fieldWidth, 20)
                .build());

        settingsButton = addDrawableChild(ButtonWidget.builder(
                        bindingText("screen.tiger_macro.config_key", TigerMacroClient.OPEN_CONFIG_KEY),
                        button -> startCapture(MacroKeybinds.BindingType.SETTINGS))
                .dimensions(center - fieldWidth / 2, 130, fieldWidth, 20)
                .build());

        int sliderWidth = Math.min(420, width - 40);
        delaySlider = new DelaySlider(
                center - sliderWidth / 2,
                176,
                sliderWidth,
                20,
                TigerMacroClient.getConfig().getDelayMs()
        );
        addDrawableChild(delaySlider);

        addDrawableChild(ButtonWidget.builder(
                        Text.translatable("screen.tiger_macro.save"),
                        button -> saveAndClose())
                .dimensions(center - 105, 286, 100, 20)
                .build());

        addDrawableChild(ButtonWidget.builder(
                        Text.translatable("screen.tiger_macro.cancel"),
                        button -> cancelAndClose())
                .dimensions(center + 5, 286, 100, 20)
                .build());
    }

    private Text bindingText(String translationKey, KeyBinding keyBinding) {
        if (capturing != null && MacroKeybinds.getBinding(capturing) == keyBinding) {
            return Text.translatable(translationKey, Text.translatable("screen.tiger_macro.set_key"));
        }
        return Text.translatable(translationKey, keyBinding.getBoundKeyLocalizedText());
    }

    private Text globalStatusText() {
        return Text.translatable(
                TigerMacroClient.getController().isGlobalEnabled()
                        ? "screen.tiger_macro.enabled"
                        : "screen.tiger_macro.disabled"
        );
    }

    private void startCapture(MacroKeybinds.BindingType type) {
        capturing = type;
        errorMessage = null;
        refreshBindingButtons();
    }

    @Override
    public boolean keyPressed(KeyInput input) {
        if (capturing != null) {
            if (input.key() == GLFW.GLFW_KEY_ESCAPE) {
                capturing = null;
                errorMessage = null;
                refreshBindingButtons();
                return true;
            }

            InputUtil.Key candidate = InputUtil.fromKeyCode(input);
            if (MacroKeybinds.conflictsWithOtherControls(capturing, candidate)) {
                errorMessage = Text.translatable("screen.tiger_macro.key_in_use").getString();
                return true;
            }

            MacroKeybinds.getBinding(capturing).setBoundKey(candidate);
            KeyBinding.updateKeysByCode();
            client.options.write();
            capturing = null;
            errorMessage = null;
            refreshBindingButtons();
            return true;
        }

        if (input.key() == GLFW.GLFW_KEY_ESCAPE) {
            cancelAndClose();
            return true;
        }

        return super.keyPressed(input);
    }

    private void refreshBindingButtons() {
        if (placementButton != null) {
            placementButton.setMessage(
                    bindingText("screen.tiger_macro.toggle_key", TigerMacroClient.TOGGLE_MACRO_KEY)
            );
        }
        if (globalButton != null) {
            globalButton.setMessage(
                    bindingText("screen.tiger_macro.global_key", TigerMacroClient.TOGGLE_GLOBAL_KEY)
            );
        }
        if (settingsButton != null) {
            settingsButton.setMessage(
                    bindingText("screen.tiger_macro.config_key", TigerMacroClient.OPEN_CONFIG_KEY)
            );
        }
    }

    private void saveAndClose() {
        TigerMacroClient.getConfig().setDelayMs(delaySlider.getDelayMs());
        TigerMacroClient.getConfig().save();
        KeyBinding.updateKeysByCode();
        client.options.write();
        TigerMacroClient.getController().resetMacroState();
        client.setScreen(parent);
    }

    private void cancelAndClose() {
        TigerMacroClient.TOGGLE_MACRO_KEY.setBoundKey(originalPlacementKey);
        TigerMacroClient.TOGGLE_GLOBAL_KEY.setBoundKey(originalGlobalKey);
        TigerMacroClient.OPEN_CONFIG_KEY.setBoundKey(originalSettingsKey);
        KeyBinding.updateKeysByCode();
        client.options.write();

        TigerMacroClient.getConfig().setDelayMs(originalDelayMs);
        TigerMacroClient.getController().resetMacroState();
        client.setScreen(parent);
    }

    @Override
    public void close() {
        cancelAndClose();
    }

    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float deltaTicks) {
        renderBackground(context, mouseX, mouseY, deltaTicks);
        context.drawCenteredTextWithShadow(
                textRenderer,
                title,
                width / 2,
                28,
                0xFFFFFF
        );
        context.drawCenteredTextWithShadow(
                textRenderer,
                Text.translatable("screen.tiger_macro.placement_macro"),
                width / 2,
                56,
                0xFFFFFF
        );

        int currentDelay = delaySlider == null
                ? TigerMacroClient.getConfig().getDelayMs()
                : delaySlider.getDelayMs();
        context.drawCenteredTextWithShadow(
                textRenderer,
                Text.translatable("screen.tiger_macro.current_delay", currentDelay),
                width / 2,
                207,
                0xFFFFFF
        );

        Text macroStatus = Text.translatable(
                "screen.tiger_macro.macro_status",
                Text.translatable(
                        TigerMacroClient.getController().isMacroEnabled()
                                ? "screen.tiger_macro.on"
                                : "screen.tiger_macro.off"
                )
        );
        context.drawCenteredTextWithShadow(textRenderer, macroStatus, width / 2, 227, 0xFFFFFF);

        Text globalStatus = Text.translatable(
                "screen.tiger_macro.global_status",
                globalStatusText()
        );
        context.drawCenteredTextWithShadow(textRenderer, globalStatus, width / 2, 246, 0xFFFFFF);

        if (errorMessage != null) {
            context.drawCenteredTextWithShadow(
                    textRenderer,
                    Text.literal(errorMessage),
                    width / 2,
                    270,
                    0xFF5555
            );
        }

        super.render(context, mouseX, mouseY, deltaTicks);
    }

    @Override
    public boolean shouldPause() {
        return false;
    }

    private final class DelaySlider extends SliderWidget {
        private int delayMs;

        private DelaySlider(int x, int y, int width, int height, int delayMs) {
            super(
                    x,
                    y,
                    width,
                    height,
                    Text.translatable("screen.tiger_macro.repeat_delay", MacroConfig.clampDelay(delayMs)),
                    normalizedValue(delayMs)
            );
            this.delayMs = MacroConfig.clampDelay(delayMs);
        }

        @Override
        protected void updateMessage() {
            setMessage(Text.translatable("screen.tiger_macro.repeat_delay", delayMs));
        }

        @Override
        protected void applyValue() {
            delayMs = fromNormalized(value);
            updateMessage();
        }

        private int getDelayMs() {
            return delayMs;
        }

        private static double normalizedValue(int delay) {
            return (MacroConfig.clampDelay(delay) - MacroConfig.MIN_DELAY_MS)
                    / (double) (MacroConfig.MAX_DELAY_MS - MacroConfig.MIN_DELAY_MS);
        }

        private int fromNormalized(double value) {
            return MacroConfig.MIN_DELAY_MS
                    + (int) Math.round(
                    value * (MacroConfig.MAX_DELAY_MS - MacroConfig.MIN_DELAY_MS)
            );
        }
    }
}
