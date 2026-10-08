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

/** Clean in-game configuration UI for the four macro controls. */
public final class MacroConfigScreen extends Screen {
    private final MinecraftClient client;
    private final Screen parent;

    private final InputUtil.Key originalPlacementKey;
    private final InputUtil.Key originalGlobalKey;
    private final InputUtil.Key originalMechanizedKey;
    private final InputUtil.Key originalSettingsKey;
    private final int originalDelayMs;

    private MacroKeybinds.BindingType capturing;
    private String errorMessage;
    private DelaySlider delaySlider;
    private ButtonWidget placementButton;
    private ButtonWidget globalButton;
    private ButtonWidget mechanizedButton;
    private ButtonWidget settingsButton;

    public MacroConfigScreen(MinecraftClient client, Screen parent) {
        super(Text.translatable("screen.tiger_macro.title"));
        this.client = client;
        this.parent = parent;
        this.originalPlacementKey = MacroKeybinds.getBoundKey(TigerMacroClient.TOGGLE_MACRO_KEY);
        this.originalGlobalKey = MacroKeybinds.getBoundKey(TigerMacroClient.TOGGLE_GLOBAL_KEY);
        this.originalMechanizedKey = MacroKeybinds.getBoundKey(TigerMacroClient.MECHANIZED_KEY);
        this.originalSettingsKey = MacroKeybinds.getBoundKey(TigerMacroClient.OPEN_CONFIG_KEY);
        this.originalDelayMs = TigerMacroClient.getConfig().getDelayMs();
    }

    @Override
    protected void init() {
        clearChildren();
        int center = width / 2;
        int fieldWidth = Math.min(390, width - 30);

        int saveY = height - 28;
        int globalStatusY = saveY - 39;
        int macroStatusY = globalStatusY - 17;
        int currentDelayY = macroStatusY - 21;
        int sliderY = currentDelayY - 27;
        int settingsY = sliderY - 26;
        int mechanizedY = settingsY - 26;
        int globalY = mechanizedY - 26;
        int toggleY = globalY - 26;

        placementButton = addDrawableChild(ButtonWidget.builder(
                        bindingText("screen.tiger_macro.toggle_key", TigerMacroClient.TOGGLE_MACRO_KEY),
                        button -> startCapture(MacroKeybinds.BindingType.PLACEMENT))
                .dimensions(center - fieldWidth / 2, toggleY, fieldWidth, 20)
                .build());

        globalButton = addDrawableChild(ButtonWidget.builder(
                        bindingText("screen.tiger_macro.global_key", TigerMacroClient.TOGGLE_GLOBAL_KEY),
                        button -> startCapture(MacroKeybinds.BindingType.GLOBAL))
                .dimensions(center - fieldWidth / 2, globalY, fieldWidth, 20)
                .build());

        mechanizedButton = addDrawableChild(ButtonWidget.builder(
                        bindingText("screen.tiger_macro.mechanized_key", TigerMacroClient.MECHANIZED_KEY),
                        button -> startCapture(MacroKeybinds.BindingType.MECHANIZED))
                .dimensions(center - fieldWidth / 2, mechanizedY, fieldWidth, 20)
                .build());

        settingsButton = addDrawableChild(ButtonWidget.builder(
                        bindingText("screen.tiger_macro.config_key", TigerMacroClient.OPEN_CONFIG_KEY),
                        button -> startCapture(MacroKeybinds.BindingType.SETTINGS))
                .dimensions(center - fieldWidth / 2, settingsY, fieldWidth, 20)
                .build());

        int sliderWidth = Math.min(420, width - 30);
        delaySlider = new DelaySlider(
                center - sliderWidth / 2,
                sliderY,
                sliderWidth,
                20,
                TigerMacroClient.getConfig().getDelayMs()
        );
        addDrawableChild(delaySlider);

        addDrawableChild(ButtonWidget.builder(
                        Text.translatable("screen.tiger_macro.save"),
                        button -> saveAndClose())
                .dimensions(center - 105, saveY, 100, 20)
                .build());

        addDrawableChild(ButtonWidget.builder(
                        Text.translatable("screen.tiger_macro.cancel"),
                        button -> cancelAndClose())
                .dimensions(center + 5, saveY, 100, 20)
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
                    bindingText("screen.tiger_macro.toggle_key", TigerMacroClient.TOGGLE_MACRO_KEY));
        }
        if (globalButton != null) {
            globalButton.setMessage(
                    bindingText("screen.tiger_macro.global_key", TigerMacroClient.TOGGLE_GLOBAL_KEY));
        }
        if (mechanizedButton != null) {
            mechanizedButton.setMessage(
                    bindingText("screen.tiger_macro.mechanized_key", TigerMacroClient.MECHANIZED_KEY));
        }
        if (settingsButton != null) {
            settingsButton.setMessage(
                    bindingText("screen.tiger_macro.config_key", TigerMacroClient.OPEN_CONFIG_KEY));
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
        TigerMacroClient.MECHANIZED_KEY.setBoundKey(originalMechanizedKey);
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
        // Screen.render() already handles the background in 1.21.11.
        // Calling renderBackground() before super.render() caused the exact crash
        // seen in the report: "Can only blur once per frame".
        super.render(context, mouseX, mouseY, deltaTicks);

        int saveY = height - 28;
        int globalStatusY = saveY - 39;
        int macroStatusY = globalStatusY - 17;
        int currentDelayY = macroStatusY - 21;

        context.drawCenteredTextWithShadow(textRenderer, title, width / 2, 8, 0xFFFFFF);
        context.drawCenteredTextWithShadow(
                textRenderer,
                Text.translatable("screen.tiger_macro.placement_macro"),
                width / 2,
                25,
                0xFFFFFF
        );
        context.drawCenteredTextWithShadow(
                textRenderer,
                Text.translatable(
                        "screen.tiger_macro.current_delay",
                        delaySlider == null
                                ? TigerMacroClient.getConfig().getDelayMs()
                                : delaySlider.getDelayMs()
                ),
                width / 2,
                currentDelayY + 15,
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
        context.drawCenteredTextWithShadow(
                textRenderer,
                macroStatus,
                width / 2,
                macroStatusY + 7,
                0xFFFFFF
        );

        Text globalStatus = Text.translatable(
                "screen.tiger_macro.global_status",
                globalStatusText()
        );
        context.drawCenteredTextWithShadow(
                textRenderer,
                globalStatus,
                width / 2,
                globalStatusY + 7,
                0xFFFFFF
        );

        if (errorMessage != null) {
            context.drawCenteredTextWithShadow(
                    textRenderer,
                    Text.literal(errorMessage),
                    width / 2,
                    saveY - 11,
                    0xFF5555
            );
        }
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
                    Text.translatable(
                            "screen.tiger_macro.repeat_delay",
                            MacroConfig.clampDelay(delayMs)
                    ),
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
