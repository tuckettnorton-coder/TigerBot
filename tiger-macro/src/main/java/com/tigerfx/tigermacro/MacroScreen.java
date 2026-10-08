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
        int sliderY = height / 2 - 10;

        addDrawableChild(new DelaySlider(
                centerX - 110,
                sliderY,
                220,
                20,
                MacroConfig.MIN_DELAY_MS,
                MacroConfig.MAX_DELAY_MS,
                TigerMacroClient.getConfig().getDelayMs()
        ));

        addDrawableChild(ButtonWidget.builder(Text.literal("Done"), button -> close())
                .dimensions(centerX - 110, sliderY + 42, 220, 20)
                .build());
    }

    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float delta) {
        renderBackground(context, mouseX, mouseY, delta);

        int centerX = width / 2;
        context.drawCenteredTextWithShadow(textRenderer, title, centerX, height / 2 - 62, 0xFFFFFF);
        context.drawCenteredTextWithShadow(
                textRenderer,
                Text.literal("Macro: " + (TigerMacroClient.getConfig().isEnabled() ? "ON" : "OFF")),
                centerX,
                height / 2 - 40,
                0xFFFFFF
        );
        context.drawCenteredTextWithShadow(
                textRenderer,
                Text.literal("Move the slider to set the repeat interval."),
                centerX,
                height / 2 + 20,
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
        private final int min;
        private final int max;
        private int currentDelay;

        private DelaySlider(int x, int y, int width, int height, int min, int max, int currentDelay) {
            super(x, y, width, height, Text.empty(), toValue(currentDelay, min, max));
            this.min = min;
            this.max = max;
            this.currentDelay = MacroConfig.clampDelay(currentDelay);
            updateMessage();
        }

        private static double toValue(int delay, int min, int max) {
            return (double) (MacroConfig.clampDelay(delay) - min) / (double) (max - min);
        }

        private int fromValue() {
            return MacroConfig.clampDelay(min + (int) Math.round(value * (max - min)));
        }

        @Override
        protected void updateMessage() {
            setMessage(Text.literal("Delay: " + fromValue() + " ms"));
        }

        @Override
        protected void applyValue() {
            int newDelay = fromValue();
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
