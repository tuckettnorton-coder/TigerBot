package net.tigerfx.tigerauction;

import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

/** Five persistent auction templates with Save, Use, and Delete controls. */
public final class AuctionPresetsScreen extends Screen {
    private final AuctionScreen parent;
    private String status = "Save the current item, quantity, minimum, maximum and timer into any slot.";
    public AuctionPresetsScreen(AuctionScreen parent){
        super(Component.literal("Tiger Auction - Saved Presets"));
        this.parent = parent;
    }
    @Override protected void init() {
        int cx=width/2, top=height/2-110;
        for(int i=0;i<5;i++) {
            final int slot=i;
            AuctionPresets.Preset p = AuctionPresets.get(i);
            String title=(i+1)+". "+(p==null?"[EMPTY]":p.label());
            if(title.length()>24) title=title.substring(0,23)+"...";
            addRenderableWidget(Button.builder(Component.literal(title),b->{
                if(AuctionPresets.get(slot)!=null) {
                    AuctionPresets.select(slot);
                    minecraft.gui.setScreen(parent);
                }
            }).bounds(cx-200, top+30+i*30, 190, 23).build());
            addRenderableWidget(Button.builder(Component.literal("SAVE"), b->{
                parent.savePreset(slot);
                minecraft.gui.setScreen(new AuctionPresetsScreen(parent));
            }).bounds(cx-3,top+30+i*30,60,23).build());
            addRenderableWidget(Button.builder(Component.literal("DELETE"),b->{
                AuctionPresets.clear(slot);
                minecraft.gui.setScreen(new AuctionPresetsScreen(parent));
            }).bounds(cx+64,top+30+i*30,88,23).build());
        }
        addRenderableWidget(Button.builder(Component.literal("BACK TO AUCTION"),b->onClose())
            .bounds(cx-100,top+192,200,22).build());
    }
    @Override public void extractRenderState(GuiGraphicsExtractor g,int mouseX,int mouseY,float delta) {
        g.fill(0,0,width,height,0xB0000000);
        int cx=width/2,top=height/2-110;
        g.fill(cx-212,top-15,cx+212,top+227,0xEF17110B);
        g.fill(cx-212,top-15,cx+212,top-12,0xFFFFC857);
        g.centeredText(font,Component.literal("TIGER AUCTION  |  5 SAVED PRESETS"),cx,top-7,0xFFFFE8A5);
        g.centeredText(font,Component.literal("Click a saved preset to load it • Save overwrites the slot"),cx,top+12,0xFFDCC69D);
        super.extractRenderState(g,mouseX,mouseY,delta);
    }
    @Override public void onClose(){minecraft.gui.setScreen(parent);}
    @Override public boolean isPauseScreen(){return false;}
}
