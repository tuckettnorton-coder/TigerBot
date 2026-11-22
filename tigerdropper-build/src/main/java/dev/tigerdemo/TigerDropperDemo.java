package dev.tigerdemo;

import com.google.gson.*;
import com.mojang.blaze3d.platform.InputConstants;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.loader.api.FabricLoader;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.hud.VanillaHudElements;
import net.minecraft.client.Minecraft;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.DeltaTracker;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.client.renderer.HitResult;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import java.nio.file.*;
import java.util.*;

public final class TigerDropperDemo implements ClientModInitializer {
  private static final String ID="tigerdropperdemo";
  private static final KeyMapping.Category CATEGORY=KeyMapping.Category.register(Identifier.fromNamespaceAndPath(ID,"controls"));
  private static KeyMapping bind(String name,int key){return KeyMappingHelper.registerKeyMapping(new KeyMapping("key."+ID+"."+name,InputConstants.Type.KEYBOARD,key,CATEGORY));}
  private static final KeyMapping PANEL=bind("panel",InputConstants.KEY_B), HELD=bind("held",InputConstants.KEY_N);
  private static final KeyMapping WIN=bind("host_demo",InputConstants.KEY_Z), LOSE=bind("viewer_demo",InputConstants.KEY_X), RANDOM=bind("random_demo",InputConstants.KEY_C);
  private static final KeyMapping TARGET_HOST=bind("target_host",InputConstants.KEY_G), TARGET_VIEWER=bind("target_viewer",InputConstants.KEY_V);
  private static final String[][] IDs=new String[2][9], NAMES=new String[2][9];
  private static final int[][] NUMBERS=new int[2][9];
  private static final String[] TARGETS=new String[2];
  private static final ItemStack[][] STACKS=new ItemStack[2][9];
  private static final Gson JSON=new GsonBuilder().setPrettyPrinting().create();
  private static Path FILE;
  private static boolean initialized=false;
  private static int side=0,slot=0,overlayTicks=0,overlaySide=0,overlaySlot=0;
  private static String overlayMode="";
  static {for(int s=0;s<2;s++)for(int i=0;i<9;i++){NUMBERS[s][i]=i+1; STACKS[s][i]=ItemStack.EMPTY;}}

  @Override public void onInitializeClient(){
    FILE=FabricLoader.getInstance().getConfigDir().resolve(ID+"-clean.json");
    load();
    ClientTickEvents.END_CLIENT_TICK.register(TigerDropperDemo::tick);
    HudElementRegistry.attachElementAfter(VanillaHudElements.HOTBAR,Identifier.fromNamespaceAndPath(ID,"visual_preview"),TigerDropperDemo::renderDemo);
  }
  private static void tick(Minecraft mc) {
    if(mc.player==null||mc.level==null)return;
    if(overlayTicks>0)overlayTicks--;
    while(PANEL.consumeClick())mc.gui.setScreen(new ConfigPanel(ItemStack.EMPTY));
    while(HELD.consumeClick())mc.gui.setScreen(new ConfigPanel(mc.player.getMainHandItem().copy()));
    while(WIN.consumeClick())show(0,slot,"HOST WIN DEMO");
    while(LOSE.consumeClick())show(1,slot,"VIEWER WIN DEMO");
    while(RANDOM.consumeClick()){int s=java.util.concurrent.ThreadLocalRandom.current().nextInt(2);show(s,java.util.concurrent.ThreadLocalRandom.current().nextInt(9),"RANDOM DEMO");}
    while(TARGET_HOST.consumeClick())target(mc,0);
    while(TARGET_VIEWER.consumeClick())target(mc,1);
  }
  private static void target(Minecraft mc,int targetSide){
    if(mc.hitResult instanceof BlockHitResult hit){
      var st=mc.level.getBlockState(hit.getBlockPos());
      if(st.getBlock()==Blocks.DROPPER || st.getBlock()==Blocks.DISPENSER){
        var p=hit.getBlockPos();
        TARGETS[targetSide]=p.getX()+","+p.getY()+","+p.getZ();
        save();
      }
    }
  }
  private static void show(int s,int i,String mode){
    if(STACKS[s][i]==null || STACKS[s][i].isEmpty())return;
    overlaySide=s;overlaySlot=i;overlayMode=mode;overlayTicks=65;
  }
  private static void renderDemo(GuiGraphicsExtractor g, DeltaTracker time){
    Minecraft mc=Minecraft.getInstance();
    if(overlayTicks<=0||mc.player==null||mc.gui.hud.isHidden())return;
    int left=Math.max(4,g.guiWidth()-254), top=Math.max(4,g.guiHeight()-107);
    g.fill(left,top,left+246,top+56,0xE9222936);
    g.text(mc.font,"VISUAL SIMULATION - NOT SERVER RESULT",left+5,top+5,0xFFFFDC66,true);
    g.item(STACKS[overlaySide][overlaySlot],left+8,top+25);
    String label=NAMES[overlaySide][overlaySlot];
    if(label==null||label.isEmpty())label=IDs[overlaySide][overlaySlot];
    g.text(mc.font,overlayMode+" #"+NUMBERS[overlaySide][overlaySlot],left+34,top+25,0xFFFFFFFF,true);
    if(label!=null)g.text(mc.font,label.length()>29?label.substring(0,29):label,left+34,top+39,0xFFBEDFFF,false);
  }
  private static void set(int s,int i,ItemStack stack,String name,int num){
    STACKS[s][i]=stack.isEmpty()?ItemStack.EMPTY:stack.copy();
    if(!STACKS[s][i].isEmpty())STACKS[s][i].setCount(1);
    IDs[s][i]=stack.isEmpty()?null:BuiltInRegistries.ITEM.getKey(stack.getItem()).toString();
    NAMES[s][i]=name;
    NUMBERS[s][i]=num;
    side=s;slot=i;save();
  }
  private static void load(){
    try {
      if(!Files.exists(FILE))return;
      JsonObject root=JsonParser.parseString(Files.readString(FILE)).getAsJsonObject();
      for(int s=0;s<2;s++)for(int i=0;i<9;i++){
        String key=(s==0?"host":"viewer")+i;
        if(!root.has(key))continue;
        JsonObject obj=root.getAsJsonObject(key);
        if(obj.has("id")){
          String id=obj.get("id").getAsString();
          Item item=BuiltInRegistries.ITEM.getValue(Identifier.parse(id));
          if(item!=null){IDs[s][i]=id;STACKS[s][i]=new ItemStack(item);}
        }
        if(obj.has("name"))NAMES[s][i]=obj.get("name").getAsString();
        if(obj.has("number"))NUMBERS[s][i]=Math.max(1,Math.min(9,obj.get("number").getAsInt()));
      }
      for(int s=0;s<2;s++){String k=s==0?"hostTarget":"viewerTarget";if(root.has(k))TARGETS[s]=root.get(k).getAsString();}
    }catch(Exception ignored){}
  }
  private static void save(){
    try{
      JsonObject root=new JsonObject();
      for(int s=0;s<2;s++)for(int i=0;i<9;i++){
        JsonObject obj=new JsonObject();
        if(IDs[s][i]!=null)obj.addProperty("id",IDs[s][i]);
        if(NAMES[s][i]!=null)obj.addProperty("name",NAMES[s][i]);
        obj.addProperty("number",NUMBERS[s][i]);
        root.add((s==0?"host":"viewer")+i,obj);
      }
      for(int s=0;s<2;s++)if(TARGETS[s]!=null)root.addProperty(s==0?"hostTarget":"viewerTarget",TARGETS[s]);
      Files.createDirectories(FILE.getParent());Files.writeString(FILE,JSON.toJson(root));
    }catch(Exception ignored){}
  }
  private static class ConfigPanel extends Screen {
    private ItemStack draft;
    private int editSide=side,editSlot=slot,editNumber=NUMBERS[side][slot];
    private EditBox nameInput;
    private String name="",notice="Pick an item, choose Host/Viewer, slot, number, then Save.";
    private int x,y;
    ConfigPanel(ItemStack item){super(Component.literal("Tiger Dropper - Visual Demo Settings"));draft=item==null?ItemStack.EMPTY:item;name=Objects.toString(NAMES[editSide][editSlot],"");}
    private void add(String label,int px,int py,int w,Runnable run){
      this.addRenderableWidget(Button.builder(Component.literal(label),b->run.run()).bounds(px,py,w,20).build());
    }
    private void rebuild(){this.clearWidgets();this.init();}
    @Override protected void init(){
      x=Math.max(4,(this.width-376)/2);y=Math.max(12,(this.height-290)/2);
      add("Browse all items",x,y,130,()->this.minecraft.gui.setScreen(new Picker(this)));
      add("Capture held",x+136,y,108,()->{if(this.minecraft.player!=null)draft=this.minecraft.player.getMainHandItem().copy();notice="Held item captured";});
      add("Close",x+250,y,68,this::onClose);
      add(editSide==0?"Side: HOST":"Side: VIEWER",x,y+28,142,()->{editSide=1-editSide;editNumber=NUMBERS[editSide][editSlot];name=Objects.toString(NAMES[editSide][editSlot],"");rebuild();});
      add("Save selected item",x+150,y+28,166,this::store);
      nameInput=new EditBox(this.font,x,y+58,316,20,Component.literal("Item display name"));
      nameInput.setMaxLength(42);nameInput.setValue(name);nameInput.setResponder(t->name=t);this.addRenderableWidget(nameInput);
      for(int i=0;i<9;i++){final int j=i;add((i==editSlot?"[":"")+(i+1)+(i==editSlot?"]":""),x+i*35,y+103,32,()->{editSlot=j;editNumber=NUMBERS[editSide][editSlot];name=Objects.toString(NAMES[editSide][editSlot],"");rebuild();});}
      for(int i=0;i<9;i++){final int n=i+1;add((n==editNumber?"[":"")+n+(n==editNumber?"]":""),x+i*35,y+147,32,()->{editNumber=n;rebuild();});}
      add("Clear slot",x,y+188,99,()->{set(editSide,editSlot,ItemStack.EMPTY,null,editNumber);notice="Slot cleared";rebuild();});
      add("Play labeled preview",x+105,y+188,155,()->{show(editSide,editSlot,"SELECTED SLOT DEMO");notice="Visual simulation only";});
      add("Done",x+266,y+188,50,this::onClose);
    }
    private void store(){
      if(draft==null||draft.isEmpty()){notice="Select an item before saving";return;}
      set(editSide,editSlot,draft,name,editNumber);notice="Saved "+(editSide==0?"Host":"Viewer")+" slot "+(editSlot+1);
    }
    @Override public void extractRenderState(GuiGraphicsExtractor g,int mx,int my,float a){
      super.extractRenderState(g,mx,my,a);
      g.text(this.font,"VISUAL SIMULATION SETTINGS (not live server results)",x,y-12,0xFFFFFFAA,true);
      g.text(this.font,"Display name (optional):",x,y+47,0xFFFFFFFF,false);
      g.text(this.font,"Physical slot (1-9):",x,y+88,0xFFFFFFFF,false);
      g.text(this.font,"Displayed number (1-9):",x,y+132,0xFFFFFFFF,false);
      String old=IDs[editSide][editSlot];
      g.text(this.font,"Saved: "+(old==null?"Empty":old),x,y+224,0xFFBBEEFF,false);
      g.text(this.font,notice,x,y+240,0xFFFFCE7B,false);
      if(draft!=null&&!draft.isEmpty())g.item(draft,x+332,y+4);
    }
    @Override public void onClose(){this.minecraft.gui.setScreen(null);}
  }
  private static class Picker extends Screen{
    private final ConfigPanel parent;
    private EditBox search;
    private String filter="";
    private int page=0,x,y;
    private final List<Item> results=new ArrayList<>();
    Picker(ConfigPanel parent){super(Component.literal("Tiger Dropper - Browse Items"));this.parent=parent;}
    private void refresh(){
      results.clear();
      for(Item item:BuiltInRegistries.ITEM){String name=BuiltInRegistries.ITEM.getKey(item).toString();if(name.contains(filter.toLowerCase(Locale.ROOT)))results.add(item);}
      results.sort(Comparator.comparing(it->BuiltInRegistries.ITEM.getKey(it).toString()));
    }
    @Override protected void init(){x=Math.max(4,(width-428)/2);y=Math.max(12,(height-278)/2);refresh();buttons();}
    private void buttons(){
      this.clearWidgets();
      search=new EditBox(this.font,x,y+25,275,20,Component.literal("Search item ID"));search.setValue(filter);search.setResponder(t->filter=t);addRenderableWidget(search);
      add("Search",x+280,y+25,69,()->{filter=search.getValue().toLowerCase(Locale.ROOT);page=0;refresh();buttons();});
      add("Back",x+356,y+25,69,this::onClose);
      for(int i=0;i<24;i++){int at=page*24+i;if(at>=results.size())break;
        Item item=results.get(at);String id=BuiltInRegistries.ITEM.getKey(item).toString();
        String label=id.startsWith("minecraft:")?id.substring(10):id;
        if(label.length()>19)label=label.substring(0,18)+"...";
        int xx=x+(i%3)*142,yy=y+50+(i/3)*23;
        add(label,xx,yy,138,()->{parent.draft=new ItemStack(item);parent.notice="Selected "+id;this.minecraft.gui.setScreen(parent);});
      }
      add("Previous",x,y+239,100,()->{page=Math.max(0,page-1);buttons();});
      add("Next",x+328,y+239,100,()->{if((page+1)*24<results.size())page++;buttons();});
    }
    private void add(String s,int xx,int yy,int w,Runnable act){addRenderableWidget(Button.builder(Component.literal(s),b->act.run()).bounds(xx,yy,w,20).build());}
    @Override public void extractRenderState(GuiGraphicsExtractor g,int mx,int my,float dt){super.extractRenderState(g,mx,my,dt);g.text(this.font,"SEARCH ALL REGISTERED ITEMS - DEMO",x,y+4,0xFFFFE49B,true);g.text(this.font,"Page "+(page+1),x+187,y+244,0xFFFFFFFF,false);}
    @Override public void onClose(){this.minecraft.gui.setScreen(parent);}
  }
}