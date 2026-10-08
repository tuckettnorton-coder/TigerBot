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

/** Configuration UI for the macro's three controls and repeat delay. */
public final class MacroConfigScreen extends Screen {
    private final MinecraftClient client;
    private final Screen parent;

    private final InputUtil.Key originalEnableDisableKey;
    private final InputUtil.Key originalMechanizedKey;
    private final InputUtil.Key originalSettingsKey;
    private final int originalDelayMs;
    private final boolean originalMacroEnabled;

    private MacroKeybinds.BindingType capturing;
    private String errorMessage;
    private DelaySlider delaySlider;
    private ButtonWidget enableDisableButton;
    private ButtonWidget mechanizedButton;
    private ButtonWidget settingsButton;

    public MacroConfigScreen(MinecraftClient client, Screen parent) {
        super(Text.translatable("screen.tiger_macro.title"));
        this.client = client;
        this.parent = parent;
        this.originalEnableDisableKey =
                MacroKeybinds.getBoundKey(TigerMacroClient.ENABLE_DISABLE_KEY);
        this.originalMechanizedKey =
                MacroKeybinds.getBoundKey(TigerMacroClient.MECHANIZED_KEY);
        this.originalSettingsKey =
                MacroKeybinds.getBoundKey(TigerMacroClient.OPEN_CONFIG_KEY);
        this.originalDelayMs = TigerMacroClient.getConfig().getDelayMs();
        this.originalMacroEnabled = TigerMacroClient.getController().isMacroEnabled();

        // Opening the settings screen temporarily resets runtime macro state.
        TigerMacroClient.getController().resetMacroState();
    }

    @Override
    protected void init() {
        clearChildren();

        int center = width / 2;
        int fieldWidth = Math.min(390, width - 30);
        int saveY = height - 28;
        int sliderY = saveY - 78;
        int settingsY = sliderY - 26;
        int mechanizedY = settingsY - 26;
        int enableDisableY = mechanizedY - 26;

        enableDisableButton = addDrawableChild(ButtonWidget.builder(
                        bindingText(
                                "screen.tiger_macro.enable_disable_key",
                                TigerMacroClient.ENABLE_DISABLE_KEY
                        ),
                        button -> startCapture(MacroKeybinds.BindingType.ENABLE_DISABLE))
                .dimensions(center - fieldWidth / 2, enableDisableY, fieldWidth, 20)
                .build());

        mechanizedButton = addDrawableChild(ButtonWidget.builder(
                        bindingText(
                                "screen.tiger_macro.mechanized_key",
                                TigerMacroClient.MECHANIZED_KEY
                        ),
                        button -> startCapture(MacroKeybinds.BindingType.MECHANIZED))
                .dimensions(center - fieldWidth / 2, mechanizedY, fieldWidth, 20)
                .build());

        settingsButton = addDrawableChild(ButtonWidget.builder(
                        bindingText(
                                "screen.tiger_macro.config_key",
                                TigerMacroClient.OPEN_CONFIG_KEY
                        ),
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
            return Text.translatable(
                    translationKey,
                    Text.translatable("screen.tiger_macro.set_key")
            );
        }
        return Text.translatable(
                translationKey,
                keyBinding.getBoundKeyLocalizedText()
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
                errorMessage = Text.translatable(
                        "screen.tiger_macro.key_in_use"
                ).getString();
                return true;
            }

            MacroKeybinds.getBinding(capturing).setBoundKey(candidate);
            KeyBinding.updateKeysByCode();
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
        if (enableDisableButton != null) {
            enableDisableButton.setMessage(bindingText(
                    "screen.tiger_macro.enable_disable_key",
                    TigerMacroClient.ENABLE_DISABLE_KEY
            ));
        }
        if (mechanizedButton != null) {
            mechanizedButton.setMessage(bindingText(
                    "screen.tiger_macro.mechanized_key",
                    TigerMacroClient.MECHANIZED_KEY
            ));
        }
        if (settingsButton != null) {
            settingsButton.setMessage(bindingText(
                    "screen.tiger_macro.config_key",
                    TigerMacroClient.OPEN_CONFIG_KEY
            ));
        }
    }

    private void saveAndClose() {
        TigerMacroClient.getConfig().setDelayMs(delaySlider.getDelayMs());
        TigerMacroClient.getConfig().save();

        KeyBinding.updateKeysByCode();
        client.options.write();

        TigerMacroClient.getController().applySavedSettings(originalMacroEnabled);
        client.setScreen(parent);
    }

    private void cancelAndClose() {
        TigerMacroClient.ENABLE_DISABLE_KEY.setBoundKey(originalEnableDisableKey);
        TigerMacroClient.MECHANIZED_KEY.setBoundKey(originalMechanizedKey);
        TigerMacroClient.OPEN_CONFIG_KEY.setBoundKey(originalSettingsKey);
        KeyBinding.updateKeysByCode();
        client.options.write();

        TigerMacroClient.getConfig().setDelayMs(originalDelayMs);
        TigerMacroClient.getController().applySavedSettings(originalMacroEnabled);
        client.setScreen(parent);
    }

    @Override
    public void close() {
        cancelAndClose();
    }

    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float deltaTicks) {
        // Screen.render() already handles the background in 1.21.11.
        // Calling renderBackground() before super.render() caused the previous
        // "Can only blur once per frame" crash.
        super.render(context, mouseX, mouseY, deltaTicks);

        int center = width / 2;
        int saveY = height - 28;
        int sliderY = saveY - 78;

        context.drawCenteredTextWithShadow(
                textRenderer,
                title,
                center,
                8,
                0xFFFFFF
        );
        context.drawCenteredTextWithShadow(
                textRenderer,
                Text.translatable("screen.tiger_macro.placement_macro"),
                center,
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
                center,
                sliderY - 17,
                0xFFFFFF
        );
        context.drawCenteredTextWithShadow(
                textRenderer,
                Text.translatable(
                        "screen.tiger_macro.macro_status",
                        Text.translatable(
                                TigerMacroClient.getController().isMacroEnabled()
                                        ? "screen.tiger_macro.on"
                                        : "screen.tiger_macro.off"
                        )
                ),
                center,
                sliderY + 28,
                0xFFFFFF
        );

        if (errorMessage != null) {
            context.drawCenteredTextWithShadow(
                    textRenderer,
                    Text.literal(errorMessage),
                    center,
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
            setMessage(
                    Text.translatable(
                            "screen.tiger_macro.repeat_delay",
                            delayMs
                    )
            );
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
                    / (double) (
                    MacroConfig.MAX_DELAY_MS - MacroConfig.MIN_DELAY_MS
            );
        }

        private int fromNormalized(double value) {
            return MacroConfig.MIN_DELAY_MS
                    + (int) Math.round(
                    value * (
                            MacroConfig.MAX_DELAY_MS
                                    - MacroConfig.MIN_DELAY_MS
                    )
            );
        }
    }
}
