package com.tigerfx.tigermacro.screen;

import com.tigerfx.tigermacro.config.MacroConfig;
import com.tigerfx.tigermacro.macro.MacroManager;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.gui.widget.SliderWidget;
import net.minecraft.text.Text;

public final class MacroSettingsScreen extends Screen {
    private final Screen parent;
    private final MacroConfig config;
    private final MacroManager macroManager;
    private final int originalDelay;
    private DelaySlider delaySlider;
    private boolean confirmed;

    public MacroSettingsScreen(Screen parent, MacroConfig config, MacroManager macroManager) {
        super(Text.translatable("screen.tigermacro.settings"));
        this.parent = parent;
        this.config = config;
        this.macroManager = macroManager;
        this.originalDelay = MacroConfig.clampDelay(config.getDelayMs());
    }

    @Override
    protected void init() {
        int sliderWidth = Math.min(500, this.width - 80);
        int sliderX = (this.width - sliderWidth) / 2;
        int sliderY = this.height / 2 - 10;
        delaySlider = new DelaySlider(sliderX, sliderY, sliderWidth, 20, originalDelay);
        addDrawableChild(delaySlider);
        addDrawableChild(ButtonWidget.builder(Text.translatable("gui.done"), button -> confirmAndClose())
                .dimensions(this.width / 2 - 100, sliderY + 45, 200, 20).build());
    }

    private void confirmAndClose() {
        macroManager.setDelayMs(delaySlider.getDelayMs());
        confirmed = true;
        close();
    }

    @Override
    public void close() {
        if (!confirmed) macroManager.setDelayMs(originalDelay);
        client.setScreen(parent);
    }

    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float delta) {
        renderBackground(context, mouseX, mouseY, delta);
        context.drawCenteredTextWithShadow(textRenderer, title, this.width / 2, this.height / 2 - 70, 0xFFFFFF);
        Text status = macroManager.isEnabled()
                ? Text.translatable("text.tigermacro.status_on")
                : Text.translatable("text.tigermacro.status_off");
        context.drawCenteredTextWithShadow(textRenderer, status, this.width / 2, this.height / 2 - 42, 0xFFFFFF);
        super.render(context, mouseX, mouseY, delta);
    }

    @Override
    public boolean shouldPause() { return false; }

    private static final class DelaySlider extends SliderWidget {
        private int delayMs;
        private DelaySlider(int x, int y, int width, int height, int delayMs) {
            super(x, y, width, height, Text.empty(), toSliderValue(delayMs));
            this.delayMs = MacroConfig.clampDelay(delayMs);
            updateMessage();
        }
        int getDelayMs() { return delayMs; }

        @Override
        protected void updateMessage() { setMessage(Text.translatable("text.tigermacro.delay", delayMs)); }

        @Override
        protected void applyValue() {
            int selected = (int) Math.round(MacroConfig.MIN_DELAY_MS + value * (MacroConfig.MAX_DELAY_MS - MacroConfig.MIN_DELAY_MS));
            delayMs = Math.max(MacroConfig.MIN_DELAY_MS, Math.min(MacroConfig.MAX_DELAY_MS, selected));
            updateMessage();
        }

        private static double toSliderValue(int delayMs) {
            int clamped = MacroConfig.clampDelay(delayMs);
            return (clamped - MacroConfig.MIN_DELAY_MS) / (double) (MacroConfig.MAX_DELAY_MS - MacroConfig.MIN_DELAY_MS);
        }
    }
}