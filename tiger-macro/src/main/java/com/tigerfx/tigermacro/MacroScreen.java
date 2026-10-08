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
                centerX - 160,
                top,
                320,
                20,
                TigerMacroClient.getConfig().getDelayMs()
        ));

        addDrawableChild(ButtonWidget.builder(Text.literal("Done"), button -> close())
                .dimensions(centerX - 160, top + 48, 320, 20)
                .build());
    }

    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float delta) {
        int centerX = width / 2;
        int currentDelay = TigerMacroClient.getConfig().getDelayMs();

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
                Text.literal("Repeat interval: " + currentDelay + " ms"),
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

        // Do not call renderBackground() here. Minecraft 1.21.11 already handles
        // the screen background/blur before Screen.render.
        super.render(context, mouseX, mouseY, delta);
    }

    @Override
    public void close() {
        TigerMacroClient.stopRepeatingAndResyncHeldState();
        TigerMacroClient.getConfig().saveNowAsync();
        MinecraftClient client = MinecraftClient.getInstance();
        client.setScreen(parent);
        client.execute(TigerMacroClient::resumeRepeatingIfPossible);
    }

    private static final class DelaySlider extends SliderWidget {
        private DelaySlider(int x, int y, int width, int height, int currentDelay) {
            super(
                    x,
                    y,
                    width,
                    height,
                    Text.empty(),
                    toProgress(currentDelay)
            );
            updateMessage();
        }

        private static double toProgress(int delayMs) {
            int clamped = MacroConfig.clampDelay(delayMs);
            return (clamped - MacroConfig.MIN_DELAY_MS)
                    / (double) (MacroConfig.MAX_DELAY_MS - MacroConfig.MIN_DELAY_MS);
        }

        private int progressToDelay() {
            double clamped = Math.max(0.0, Math.min(1.0, value));
            return MacroConfig.clampDelay(
                    MacroConfig.MIN_DELAY_MS
                            + (int) Math.round(
                            clamped * (MacroConfig.MAX_DELAY_MS - MacroConfig.MIN_DELAY_MS)
                    )
            );
        }

        private void setFromMouseX(double mouseX) {
            // Explicitly map the entire widget width to the full 10..500 range.
            // Vanilla SliderWidget also maps from mouse position, but doing this
            // here makes the endpoint behavior deterministic for this mod.
            double progress = (mouseX - getX()) / (double) getWidth();
            setValue(Math.max(0.0, Math.min(1.0, progress)));
        }

        @Override
        public void onClick(Click click, boolean doubled) {
            super.onClick(click, doubled);
            setFromMouseX(click.x());
        }

        @Override
        protected void onDrag(Click click, double offsetX, double offsetY) {
            super.onDrag(click, offsetX, offsetY);
            setFromMouseX(click.x());
        }

        @Override
        protected void updateMessage() {
            setMessage(Text.literal("Delay: " + progressToDelay() + " ms"));
        }

        @Override
        protected void applyValue() {
            int newDelay = progressToDelay();
            if (newDelay == TigerMacroClient.getConfig().getDelayMs()) {
                return;
            }

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
