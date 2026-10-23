package com.tigerfx.spacebarmac;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.gui.widget.SliderWidget;
import net.minecraft.text.Text;
import org.jetbrains.annotations.Nullable;

public final class SpacebarMacroScreen extends Screen {
    private static final int MIN_DELAY_MS = 10;
    private static final int MAX_DELAY_MS = 500;

    private final @Nullable Screen parent;
    private DelaySlider delaySlider;

    public SpacebarMacroScreen(@Nullable Screen parent) {
        super(Text.translatable("screen.spacebar_macro.title"));
        this.parent = parent;
    }

    @Override
    protected void init() {
        int centerX = this.width / 2;
        int sliderWidth = 320;

        this.delaySlider = this.addDrawableChild(new DelaySlider(
                centerX - sliderWidth / 2,
                this.height / 2 - 30,
                sliderWidth,
                20,
                SpacebarMacro.getRepeatDelayMs()
        ));

        this.addDrawableChild(
                ButtonWidget.builder(
                                Text.translatable("screen.spacebar_macro.done"),
                                button -> this.close()
                        )
                        .dimensions(centerX - 100, this.height / 2 + 25, 200, 20)
                        .build()
        );
    }

    @Override
    public void close() {
        MinecraftClient.getInstance().setScreen(this.parent);
    }

    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float deltaTicks) {
        this.renderInGameBackground(context);

        context.drawCenteredTextWithShadow(
                this.textRenderer,
                this.title,
                this.width / 2,
                this.height / 2 - 90,
                0xFFFFFFFF
        );

        context.drawCenteredTextWithShadow(
                this.textRenderer,
                Text.translatable("screen.spacebar_macro.description"),
                this.width / 2,
                this.height / 2 - 65,
                0xFFCCCCCC
        );

        context.drawCenteredTextWithShadow(
                this.textRenderer,
                Text.translatable("screen.spacebar_macro.range"),
                this.width / 2,
                this.height / 2 + 55,
                0xFFAAAAAA
        );

        super.render(context, mouseX, mouseY, deltaTicks);
    }

    private static final class DelaySlider extends SliderWidget {
        private DelaySlider(int x, int y, int width, int height, int delayMs) {
            super(
                    x,
                    y,
                    width,
                    height,
                    Text.translatable("screen.spacebar_macro.slider"),
                    (delayMs - MIN_DELAY_MS) / (double) (MAX_DELAY_MS - MIN_DELAY_MS)
            );
            updateMessage();
        }

        private int getDelayMs() {
            return MIN_DELAY_MS +
                    (int) Math.round(this.value * (MAX_DELAY_MS - MIN_DELAY_MS));
        }

        @Override
        protected void updateMessage() {
            this.setMessage(
                    Text.translatable("screen.spacebar_macro.slider_value", getDelayMs())
            );
        }

        @Override
        protected void applyValue() {
            SpacebarMacro.setRepeatDelayMs(getDelayMs());
        }
    }
}
