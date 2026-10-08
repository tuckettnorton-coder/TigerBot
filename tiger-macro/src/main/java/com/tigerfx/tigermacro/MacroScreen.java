package com.tigerfx.tigermacro;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.Click;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.gui.widget.ClickableWidget;
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
        MinecraftClient client = MinecraftClient.getInstance();
        client.setScreen(parent);
        client.execute(TigerMacroClient::resumeRepeatingIfPossible);
    }

    private static final class DelaySlider extends ClickableWidget {
        private int delayMs;
        private boolean dragging;

        private DelaySlider(int x, int y, int width, int height, int currentDelay) {
            super(x, y, width, height, Text.empty());
            this.delayMs = MacroConfig.clampDelay(currentDelay);
            updateMessage();
        }

        private void updateMessage() {
            setMessage(Text.literal("Delay: " + delayMs + " ms"));
        }

        @Override
        protected void renderWidget(DrawContext context, int mouseX, int mouseY, float delta) {
            int x = getX();
            int y = getY();
            int w = getWidth();
            int h = getHeight();

            int fillWidth = Math.max(1, (int) Math.round(
                    (delayMs - MacroConfig.MIN_DELAY_MS)
                            / (double) (MacroConfig.MAX_DELAY_MS - MacroConfig.MIN_DELAY_MS)
                            * w
            ));

            context.fill(x, y, x + w, y + h, 0xFF555555);
            context.fill(x, y, x + fillWidth, y + h, 0xFF66AA66);

            int knobX = x + fillWidth - 2;
            context.fill(knobX, y - 2, knobX + 5, y + h + 2, 0xFFFFFFFF);
            context.drawCenteredTextWithShadow(
                    MinecraftClient.getInstance().textRenderer,
                    getMessage(),
                    x + w / 2,
                    y + 6,
                    0xFFFFFF
            );
        }

        @Override
        public void onClick(Click click, boolean doubled) {
            dragging = true;
            updateFromMouse(click.x());
        }

        @Override
        protected void onDrag(Click click, double deltaX, double deltaY) {
            dragging = true;
            updateFromMouse(click.x());
        }

        @Override
        public void onRelease(Click click) {
            dragging = false;
            super.onRelease(click);
            TigerMacroClient.getConfig().saveNowAsync();
        }

        private void updateFromMouse(double mouseX) {
            double normalized = (mouseX - getX()) / (double) getWidth();
            normalized = Math.max(0.0, Math.min(1.0, normalized));

            int newDelay = MacroConfig.clampDelay(
                    MacroConfig.MIN_DELAY_MS
                            + (int) Math.round(
                            normalized
                                    * (MacroConfig.MAX_DELAY_MS - MacroConfig.MIN_DELAY_MS)
                    )
            );

            if (newDelay == delayMs) return;

            delayMs = newDelay;
            TigerMacroClient.getConfig().setDelayMs(newDelay);
            TigerMacroClient.delayChanged();
            updateMessage();
        }
    }
}
