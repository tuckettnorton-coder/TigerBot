package net.tigerfx.tigerauction;

import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.network.chat.Component;
import java.util.List;

public final class ProfitScreen extends Screen {
    private final Screen parent;
    private EditBox item,amount;
    private int offset;
    private boolean showAdd;
    private boolean income=true;
    private String notice="";
    private int cx, top;
    private static final int GOLD=0xFFFFC857;
    public ProfitScreen(Screen parent) {
        super(Component.literal("Tiger Auction - Profits"));
        this.parent=parent;
    }
    @Override protected void init(){
        cx=width/2;top=height/2-135;
        addRenderableWidget(Button.builder(Component.literal("HISTORY"),b->{
            showAdd=false; minecraft.gui.setScreen(this);
        }).bounds(cx-207,top+20,93,20).build());
        addRenderableWidget(Button.builder(Component.literal("ADD MANUAL"),b->{
            showAdd=true; minecraft.gui.setScreen(this);
        }).bounds(cx-109,top+20,110,20).build());
        addRenderableWidget(Button.builder(Component.literal("BACK"),b->onClose())
            .bounds(cx+110,top+20,97,20).build());
        if(showAdd){
            item=addRenderableWidget(new EditBox(font,cx-185,top+86,370,20,Component.literal("Item / transaction")));
            item.setMaxLength(90);item.setValue("Manual transaction");
            amount=addRenderableWidget(new EditBox(font,cx-185,top+139,370,20,Component.literal("Amount")));
            amount.setMaxLength(32);amount.setValue("1M");
            addRenderableWidget(Button.builder(Component.literal(income?"TYPE: SALE / INCOME":"TYPE: PURCHASE / EXPENSE"),b->{
                income=!income;
                b.setMessage(Component.literal(income?"TYPE: SALE / INCOME":"TYPE: PURCHASE / EXPENSE"));
            }).bounds(cx-185,top+174,370,22).build());
            addRenderableWidget(Button.builder(Component.literal("SAVE TRANSACTION"),b->{
                try{ProfitLedger.manual(income,item.getValue(),amount.getValue());
                    notice="Transaction saved.";showAdd=false;minecraft.gui.setScreen(this);
                }catch(Exception ex){notice="Invalid amount. Use e.g. 1M or 250K.";}
            }).bounds(cx-185,top+203,370,24).build());
        }else{
            addRenderableWidget(Button.builder(Component.literal("PREV"),b->{
                offset=Math.max(0,offset-11);
            }).bounds(cx-197,top+245,95,19).build());
            addRenderableWidget(Button.builder(Component.literal("NEXT"),b->{
                offset=Math.min(Math.max(0,ProfitLedger.entries().size()-11),offset+11);
            }).bounds(cx+102,top+245,95,19).build());
        }
    }
    @Override public void extractRenderState(GuiGraphicsExtractor g,int mx,int my,float delta){
        g.fill(0,0,width,height,0xB0000000);
        g.fill(cx-217,top-16,cx+217,top+280,0xF011100B);
        g.fill(cx-217,top-16,cx+217,top-13,GOLD);
        g.centeredText(font,Component.literal("TIGER AUCTION  |  PROFIT TRACKER"),cx,top-7,0xFFFFE8A5);
        g.text(font,"EARNED: "+ProfitLedger.money(ProfitLedger.earned()),cx-191,top+49,0xFF7CFF9D);
        g.text(font,"SPENT: "+ProfitLedger.money(ProfitLedger.spent()),cx+19,top+49,0xFFFF998C);
        g.text(font,"NET: "+ProfitLedger.money(ProfitLedger.net()),cx-191,top+65,GOLD);
        if(showAdd){
            g.text(font,"Transaction / item",cx-185,top+74,0xFFFFE8A5);
            g.text(font,"Amount",cx-185,top+127,0xFFFFE8A5);
            g.text(font,notice,cx-185,top+238,0xFFB7DCB7);
        }else{
            List<ProfitLedger.Entry> entries=ProfitLedger.entries();
            for(int i=0;i<11&&offset+i<entries.size();i++){
                ProfitLedger.Entry e=entries.get(offset+i);
                String line=ProfitLedger.date(e.time())+"  "+e.kind()+"  "+
                  e.item()+"  $"+ProfitLedger.money(e.amount());
                if(line.length()>65)line=line.substring(0,64)+"…";
                g.text(font,line,cx-190,top+86+i*14,
                    (e.kind().equalsIgnoreCase("BUY")||e.kind().equalsIgnoreCase("BOUGHT")||e.kind().equalsIgnoreCase("PAID"))?0xFFFF998C:0xFFFFE8A5);
            }
            g.text(font,"Entries: "+entries.size()+"  •  Page "+(offset/11+1),
                cx-60,top+247,0xFFBBBBBB);
        }
        super.extractRenderState(g,mx,my,delta);
    }
    @Override public boolean isPauseScreen(){return false;}
    @Override public void onClose(){minecraft.gui.setScreen(parent);}
}
