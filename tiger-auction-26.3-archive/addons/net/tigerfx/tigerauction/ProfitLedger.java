package net.tigerfx.tigerauction;

import net.fabricmc.loader.api.FabricLoader;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.*;

/**
 * Persistent DonutSMP income/expense history. Uses TigerAuction 1.1.9's exact five-column
 * TSV schema and Base64URL fields, preserving previous profit entries and running totals.
 */
public final class ProfitLedger {
    public record Entry(String id,long time,String kind,String item,long amount) {}
    private static final Path FILE=FabricLoader.getInstance().getConfigDir().resolve("tigerauction-profit.tsv");
    private static final List<Entry> ENTRIES=new ArrayList<>();
    private static final Set<String> IDS=new HashSet<>();
    private static boolean loaded;
    private static String lastMessage="";
    private static long lastAt;
    private static final int MAX=5000;
    private static final String AMT="([0-9][0-9,]*(?:\\.[0-9]+)?\\s*[kmbt]?)";
    private static final Pattern OFFLINE=Pattern.compile("(?i)\\b(?:offline|off-line|while\\s+(?:you\\s+were\\s+)?(?:away|gone|logged\\s+out)|since\\s+you\\s+(?:last\\s+)?(?:logged\\s+out|left)|during\\s+your\\s+absence)\\b");
    private static final Pattern AH=Pattern.compile("(?i)\\b(?:ah|auction|auctionhouse|auction\\s+house|listing)\\b");
    private static final Pattern PLAYER_PAYMENT=Pattern.compile("(?i)\\b(?:players?\\s+(?:paid|sent)|payments?\\s+from\\s+players?|(?:paid|sent)\\s+by\\s+players?)\\b");
    private static final Pattern MONEY=Pattern.compile("(?i)\\$?\\s*"+AMT+"(?=\\s|\\b|[.!]|$)");
    private static final Pattern[] INCOME_ITEM={
        p("^(?:[.a-z0-9_]{1,32}|someone)\\s+(?:has\\s+|just\\s+)?(?:bought|purchased)\\s+your\\s+(.+?)\\s+(?:for|at)\\s*\\$?\\s*"+AMT),
        p("^your\\s+(.+?)\\s+(?:has\\s+been\\s+|was\\s+)?sold\\s+(?:for|at)\\s*\\$?\\s*"+AMT),
        p("^(?:you(?:\\s+have)?\\s+)?(?:successfully\\s+)?sold\\s+(.+?)\\s+(?:for|at|worth)\\s*\\$?\\s*"+AMT),
        p("^(?:you(?:\\s+have)?\\s+)?delivered\\s+(.+?)\\s+and\\s+(?:you\\s+)?(?:received|earned|got|were\\s+paid)\\s*\\$?\\s*"+AMT),
        p("^(?:you\\s+)?(?:fulfilled|completed)\\s+(?:a\\s+)?(?:buy\\s+)?order\\s+(?:of|for)\\s+(.+?)\\s+(?:for|at|and\\s+(?:received|earned))\\s*\\$?\\s*"+AMT),
        p("^(?:sell\\s+order\\s+filled|auction\\s+sold|sale\\s+completed):?\\s*(.+?)\\s+(?:for|at)\\s*\\$?\\s*"+AMT)
    };
    private static final Pattern[] EXPENSE_ITEM={
        p("^(?:you(?:\\s+have)?\\s+)?(?:successfully\\s+)?(?:bought|purchased)\\s+(.+?)\\s+(?:for|at|worth|costing)\\s*\\$?\\s*"+AMT),
        p("^(?:buy\\s+order\\s+filled|order\\s+fulfilled|purchase\\s+completed):?\\s*(.+?)\\s+(?:for|at|costing)\\s*\\$?\\s*"+AMT),
        p("^(?:your\\s+)?(?:buy\\s+order|purchase\\s+order)\\s+(?:for\\s+)?(.+?)\\s+(?:was\\s+|has\\s+been\\s+)?(?:filled|completed|fulfilled)\\s+(?:for|at|costing)\\s*\\$?\\s*"+AMT)
    };
    private static final Pattern INCOME_SELL=p("^(?:items\\s+sold[!:]?\\s*|sold\\s+items[!:]?\\s*|sale\\s+complete[!:]?\\s*)?(?:you\\s+)?(?:received|earned|made|sold(?:\\s+it)?)\\s+\\$?\\s*"+AMT+"\\s*(?:for|from)\\s+(?:your\\s+)?(?:sale|sell|order|selling)");
    private static final Pattern INCOME_DELIVERY=p("^(?:you\\s+)?(?:received|earned|got)\\s+\\$?\\s*"+AMT+"\\s+(?:for|from)\\s+(?:delivering|fulfilling)");
    private static final Pattern INCOME_RECEIPT=p("^(?:you\\s+)?(?:received|earned|got)\\s+\\$?\\s*"+AMT+"\\s+(?:from|for)\\s+(?:selling|the\\s+sale\\s+of|your\\s+sale\\s+of)");
    private static final Pattern INCOME_AUCTION=p("^(?:your\\s+)?(?:auction|item|listing|sell\\s+order)\\s+(?:was\\s+|has\\s+been\\s+)?sold\\s+(?:for|at)\\s*\\$?\\s*"+AMT);
    private static final Pattern PAYMENT_IN=p("^([.a-z0-9_]{1,32})\\s+paid\\s+you\\s+\\$?\\s*"+AMT);
    private static final Pattern PAYMENT_OUT=p("^you\\s+(?:paid|sent)\\s+([.a-z0-9_]{1,32})\\s+\\$?\\s*"+AMT);
    private static final Pattern PAYMENT_OUT_REVERSE=p("^you\\s+(?:paid|sent)\\s+\\$?\\s*"+AMT+"\\s+to\\s+([.a-z0-9_]{1,32})");
    private static final Pattern SPENT=p("^you\\s+(?:spent|were\\s+charged|paid)\\s+\\$?\\s*"+AMT+"\\s+(?:on|for)\\s+(.+)");
    private static final Pattern EARNED=p("^(?:you\\s+)?(?:received|earned|got|gained|made|collected)\\s+(?:a\\s+total\\s+of\\s+)?\\$?\\s*"+AMT);
    private static final Pattern DATE=Pattern.compile("\\s+");
    private static final DateTimeFormatter FORMAT=DateTimeFormatter.ofPattern("MM-dd HH:mm").withZone(ZoneId.systemDefault());
    private ProfitLedger(){}

    private static Pattern p(String exp) {return Pattern.compile(exp,Pattern.CASE_INSENSITIVE);}
    private static String enc(String s) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(s.getBytes(StandardCharsets.UTF_8));
    }
    private static String dec(String s) {
        return new String(Base64.getUrlDecoder().decode(s),StandardCharsets.UTF_8);
    }
    private static synchronized void load(){
        if(loaded)return;
        loaded=true;
        try{
            Files.createDirectories(FILE.getParent());
            if(Files.isRegularFile(FILE)) {
                for(String l:Files.readAllLines(FILE,StandardCharsets.UTF_8))try{
                    String[] a=l.split("\t",-1);
                    if(a.length!=5)continue;
                    Entry e=new Entry(dec(a[0]),Long.parseLong(a[1]),dec(a[2]),dec(a[3]),Long.parseLong(a[4]));
                    if(IDS.add(e.id()))ENTRIES.add(e);
                }catch(RuntimeException ignored){}
            }
            ENTRIES.sort(Comparator.comparingLong(Entry::time).reversed());
            if(ENTRIES.size()>MAX)ENTRIES.subList(MAX,ENTRIES.size()).clear();
        }catch(Exception ex){System.err.println("[TigerAuction] Profit ledger load failed: "+ex.getMessage());}
    }
    private static synchronized void persist(){
        try{
            Files.createDirectories(FILE.getParent());
            List<String> lines=new ArrayList<>();
            for(Entry e:ENTRIES)lines.add(enc(e.id())+"\t"+e.time()+"\t"+enc(e.kind())+"\t"+enc(e.item())+"\t"+e.amount());
            Path tmp=FILE.resolveSibling(FILE.getFileName()+".tmp");
            Files.write(tmp,lines,StandardCharsets.UTF_8);
            try { Files.move(tmp,FILE,StandardCopyOption.REPLACE_EXISTING,StandardCopyOption.ATOMIC_MOVE); }
            catch(AtomicMoveNotSupportedException ex){Files.move(tmp,FILE,StandardCopyOption.REPLACE_EXISTING);}
        }catch(Exception ex){System.err.println("[TigerAuction] Profit ledger save failed: "+ex.getMessage());}
    }
    private static synchronized void add(String kind,String item,long amount){
        load();
        if(amount<=0)return;
        long now=System.currentTimeMillis();
        String unique=kind+"|"+item+"|"+amount;
        if(unique.equals(lastMessage)&&now-lastAt<1000) return;
        lastMessage=unique;lastAt=now;
        Entry e=new Entry(UUID.randomUUID().toString(),now,kind,item,amount);
        if(IDS.add(e.id())) {
            ENTRIES.add(0,e);
            if(ENTRIES.size()>MAX)ENTRIES.remove(ENTRIES.size()-1);
            persist();
        }
    }
    public static long parseMoney(String raw){
        if(raw==null)throw new IllegalArgumentException("Amount missing");
        String val=raw.toUpperCase(Locale.ROOT).replace("$","").replace(",","").replaceAll("\\s+","");
        if(val.isBlank()) throw new IllegalArgumentException("Amount missing");
        long mult=1;
        char last=val.charAt(val.length()-1);
        if(Character.isLetter(last)){
            mult=switch(last){case 'K'->1000L;case 'M'->1_000_000L;case 'B'->1_000_000_000L;case 'T'->1_000_000_000_000L;default->throw new IllegalArgumentException("Invalid suffix");};
            val=val.substring(0,val.length()-1);
        }
        return new BigDecimal(val).multiply(BigDecimal.valueOf(mult)).setScale(0,RoundingMode.HALF_UP).longValueExact();
    }
    public static synchronized void manual(boolean income,String item,String amount){
        long a=parseMoney(amount);
        add(income?"SOLD":"BOUGHT",item==null||item.isBlank()?"Manual":item,a);
    }
    public static synchronized void onGameMessage(String original) {
        if(original==null || original.isBlank())return;
        String msg=original.replaceAll("(?i)§[0-9a-fk-or]","").replaceAll("(?i)<(?:/?(?:gold|yellow|gray|bold|white|reset|green)|#[0-9a-f]{6})>","").trim();
        msg=msg.replaceFirst("(?i)^(?:\\[(?:auction(?: house)?|ah|orders?|market|shop|bazaar|donutsmp|sell|delivery|economy)\\]\\s*[:>\\-]*\\s*)+","");
        if(msg.isBlank())return;
        boolean offline=OFFLINE.matcher(msg).find(), ah=AH.matcher(msg).find();
        if(offline){
            Matcher m=EARNED.matcher(msg);
            if(!m.find())m=MONEY.matcher(msg);
            if(m.find(0))try{
                long amount=parseMoney(m.group(1));
                String kind=ah?"OFFLINE_AH":PLAYER_PAYMENT.matcher(msg).find()?"OFFLINE_PAYMENT":"OFFLINE_AH";
                add(kind,ah?"Offline AH earnings":"Offline player payments",amount);
            }catch(Exception ignored){}
            return;
        }
        for(Pattern p:INCOME_ITEM) {
            Matcher m=p.matcher(msg);
            if(m.find()) { try {add(msg.toLowerCase(Locale.ROOT).contains("deliver")?"ORDER_GUI":"SOLD",m.group(1),parseMoney(m.group(2)));}catch(Exception ignored){} return; }
        }
        for(Pattern p:EXPENSE_ITEM) {
            Matcher m=p.matcher(msg);
            if(m.find()){ try {add("BOUGHT",m.group(1),parseMoney(m.group(2)));}catch(Exception ignored){} return;}
        }
        Matcher m=PAYMENT_IN.matcher(msg);
        if(m.find()){try{add("RECEIVED",m.group(1),parseMoney(m.group(2)));}catch(Exception ignored){}return;}
        m=PAYMENT_OUT.matcher(msg);
        if(m.find()){try{add("PAID",m.group(1),parseMoney(m.group(2)));}catch(Exception ignored){}return;}
        m=PAYMENT_OUT_REVERSE.matcher(msg);
        if(m.find()){try{add("PAID",m.group(2),parseMoney(m.group(1)));}catch(Exception ignored){}return;}
        m=SPENT.matcher(msg);
        if(m.find()){try{add("BOUGHT",m.group(2),parseMoney(m.group(1)));}catch(Exception ignored){}return;}
        for(Pattern p:new Pattern[]{INCOME_SELL,INCOME_DELIVERY,INCOME_RECEIPT,INCOME_AUCTION}){
            m=p.matcher(msg);
            if(m.find()){try{add(p==INCOME_DELIVERY?"ORDER_GUI":"SELL_GUI",msg.substring(0,Math.min(72,msg.length())),parseMoney(m.group(1)));}catch(Exception ignored){}return;}
        }
        if(msg.toLowerCase(Locale.ROOT).contains("sell") && !msg.toLowerCase(Locale.ROOT).contains("bought")) {
            m=EARNED.matcher(msg);
            if(m.find())try{add("SELL_GUI","Server /sell proceeds",parseMoney(m.group(1)));}catch(Exception ignored){}
        }
    }
    public static synchronized List<Entry> entries(){load();return List.copyOf(ENTRIES);}
    private static boolean isExpense(Entry e){
        return switch(e.kind().toUpperCase(Locale.ROOT)){
            case "BUY","BOUGHT","PAID","PURCHASE","ORDER","SPENT","DEBIT" -> true;
            default -> false;
        };
    }
    public static synchronized long earned(){load();long sum=0;for(Entry e:ENTRIES)if(!isExpense(e)&&!e.kind().equalsIgnoreCase("PENDING"))sum+=e.amount();return sum;}
    public static synchronized long spent(){load();long sum=0;for(Entry e:ENTRIES)if(isExpense(e))sum+=e.amount();return sum;}
    public static synchronized long net(){return earned()-spent();}
    public static String money(long amount){return AuctionState.formatMoney(amount);}
    public static String date(long millis){return FORMAT.format(Instant.ofEpochMilli(millis));}
}
