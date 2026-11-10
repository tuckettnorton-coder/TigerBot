package com.tigerfx.tigermacro;

import com.mojang.blaze3d.platform.InputConstants;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.AbstractSliderButton;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.network.chat.Component;

public final class MacroConfigScreen extends Screen {
    private final Screen parent;
    private boolean capturingKey;
    private Button targetButton;
    private Button toggleButton;

    public MacroConfigScreen(Screen parent) {
        super(Component.literal("Tiger Macro Settings"));
        this.parent = parent;
    }
    @Override protected void init() {
        int cx = this.width/2, cy = this.height/2;
        toggleButton = addRenderableWidget(Button.builder(toggleText(), b -> {
            MacroController.setEnabled(!MacroConfig.get().enabled);
            b.setMessage(toggleText());
        }).bounds(cx-105,cy-55,210,20).build());
        addRenderableWidget(new DelaySlider(cx-125,cy-25,250,20));
        addRenderableWidget(new IntervalSlider(cx-125,cy+5,250,20));
        targetButton = addRenderableWidget(Button.builder(keyText(), b -> {
            capturingKey = true;
            b.setMessage(Component.literal("Press new target key (ESC cancels)"));
        }).bounds(cx-105,cy+35,210,20).build());
        addRenderableWidget(Button.builder(Component.literal("Item Filter..."), b -> {
            minecraft.gui.setScreen(new ItemFilterScreen(this));
        }).bounds(cx-105,cy+65,210,20).build());
        addRenderableWidget(Button.builder(Component.literal("Close"), b -> onClose())
            .bounds(cx-105,cy+95,210,20).build());
    }
    @Override public void tick() {
        super.tick();
        if (toggleButton != null) toggleButton.setMessage(toggleText());
    }
    @Override public void extractRenderState(GuiGraphicsExtractor graphics, int mouseX,int mouseY,float delta) {
        super.extractRenderState(graphics,mouseX,mouseY,delta);
        graphics.centeredText(font, Component.literal("Tiger Macro Settings"), width/2,height/2-105,0xFFFFFF);
        graphics.centeredText(font, Component.literal("Hold target key to repeat. 1-500ms interval."), width/2,height/2-87,0xAAAAAA);
    }
    @Override public boolean keyPressed(KeyEvent event) {
        if (capturingKey) {
            int code = event.key();
            if (code == InputConstants.KEY_ESCAPE) {
                capturingKey = false; targetButton.setMessage(keyText()); return true;
            }
            if (TigerMacroClient.isUtilityKey(code)) {
                targetButton.setMessage(Component.literal("Choose another key (K/F8 reserved)"));
                return true;
            }
            if (code > 0) {
                TigerMacroClient.setTargetKey(code);
                capturingKey = false;
                targetButton.setMessage(keyText());
                return true;
            }
        }
        return super.keyPressed(event);
    }
    @Override public void onClose() { minecraft.gui.setScreen(parent); }
    @Override public boolean isPauseScreen() { return false; }
    private Component toggleText() {
        return Component.literal("Macro: "+(MacroConfig.get().enabled ? "ON" : "OFF"));
    }
    private Component keyText() {
        return Component.literal("Target key: "+TigerMacroClient.targetKey().getTranslatedKeyMessage().getString());
    }

    private static final class DelaySlider extends AbstractSliderButton {
        DelaySlider(int x,int y,int w,int h) {
            super(x,y,w,h,Component.empty(),MacroConfig.get().repeatDelayMs/1000.0);
            updateMessage();
        }
        private int valueMs() { return (int)Math.round(value*1000); }
        @Override protected void updateMessage() { setMessage(Component.literal("Repeat delay: "+valueMs()+" ms")); }
        @Override protected void applyValue() {
            MacroConfig.get().repeatDelayMs=valueMs(); MacroConfig.save(); MacroController.reset();
        }
    }
    private static final class IntervalSlider extends AbstractSliderButton {
        IntervalSlider(int x,int y,int w,int h) {
            super(x,y,w,h,Component.empty(),(MacroConfig.get().intervalMs-1)/499.0);
            updateMessage();
        }
        private int valueMs() { return 1+(int)Math.round(value*499); }
        @Override protected void updateMessage() { setMessage(Component.literal("Repeat interval: "+valueMs()+" ms")); }
        @Override protected void applyValue() {
            MacroConfig.get().intervalMs=valueMs(); MacroConfig.save(); MacroController.reset();
        }
    }
}
