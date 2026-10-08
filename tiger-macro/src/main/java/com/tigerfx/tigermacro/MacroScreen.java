package com.tigerfx.tigermacro;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.Click;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.gui.widget.SliderWidget;
import net.minecraft.text.Text;

public final class MacroScreen extends Screen {
    private final Screen parent;

    public MacroScreen(Screen parent) {
        super(Text.literal("Tiger Macro"));
        this.parent = parent;
    }

    @Override
    protected void init() {
        int centerX = width / 2;
        int top = height / 2 - 35;

        addDrawableChild(new DelaySlider(
                centerX - 110,
                top,
                220,
                20,
                TigerMacroClient.getConfig().getDelayMs()
        ));

        addDrawableChild(ButtonWidget.builder(Text.literal("Done"), button -> close())
                .dimensions(centerX - 110, top + 48, 220, 20)
                .build());
    }

    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float delta) {
        renderBackground(context, mouseX, mouseY, delta);

        int centerX = width / 2;
        context.drawCenteredTextWithShadow(
                textRenderer,
                title,
                centerX,
                height / 2 - 87,
                0xFFFFFF
        );
        context.drawCenteredTextWithShadow(
                textRenderer,
                Text.literal("Macro: " + (TigerMacroClient.getConfig().isEnabled() ? "ON" : "OFF")),
                centerX,
                height / 2 - 65,
                0xFFFFFF
        );
        context.drawCenteredTextWithShadow(
                textRenderer,
                Text.literal("Repeat interval"),
                centerX,
                height / 2 - 50,
                0xA0A0A0
        );
        context.drawCenteredTextWithShadow(
                textRenderer,
                Text.literal("10 ms minimum  |  500 ms maximum"),
                centerX,
                height / 2 + 76,
                0xA0A0A0
        );

        super.render(context, mouseX, mouseY, delta);
    }

    @Override
    public void close() {
        TigerMacroClient.stopRepeatingAndResyncHeldState();
        TigerMacroClient.getConfig().saveNowAsync();
        MinecraftClient.getInstance().setScreen(parent);
    }

    private static final class DelaySlider extends SliderWidget {
        private int currentDelay;

        private DelaySlider(int x, int y, int width, int height, int currentDelay) {
            super(
                    x,
                    y,
                    width,
                    height,
                    Text.literal("Delay"),
                    toProgress(currentDelay)
            );
            this.currentDelay = MacroConfig.clampDelay(currentDelay);
            updateMessage();
        }

        private static double toProgress(int delayMs) {
            int clamped = MacroConfig.clampDelay(delayMs);
            return (clamped - MacroConfig.MIN_DELAY_MS)
                    / (double) (MacroConfig.MAX_DELAY_MS - MacroConfig.MIN_DELAY_MS);
        }

        private int progressToDelay() {
            double clamped = Math.max(0.0, Math.min(1.0, value));
            int delay = MacroConfig.MIN_DELAY_MS
                    + (int) Math.round(clamped
                    * (MacroConfig.MAX_DELAY_MS - MacroConfig.MIN_DELAY_MS));
            return MacroConfig.clampDelay(delay);
        }

        @Override
        protected void updateMessage() {
            // This method is safe even while the superclass constructor is running:
            // it only uses the already-initialized protected slider value and constants.
            int delay = progressToDelay();
            setMessage(Text.literal("Delay: " + delay + " ms"));
        }

        @Override
        protected void applyValue() {
            int newDelay = progressToDelay();
            if (newDelay == currentDelay) return;

            currentDelay = newDelay;
            TigerMacroClient.getConfig().setDelayMs(newDelay);
            TigerMacroClient.delayChanged();
            updateMessage();
        }

        @Override
        public void onRelease(Click click) {
            super.onRelease(click);
            TigerMacroClient.getConfig().saveNowAsync();
        }
    }
}
