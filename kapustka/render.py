import json, math, random, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
F=json.load(open("feat.json")); hop=F["fps_hop"]
low=np.array(F["low"]); hi=np.array(F["hi"]); rms=np.array(F["rms"]); beats=np.array(F["beats"])
W,H=720,1280; FPS=24; T0=12.0; DUR=15.0
def feat(a,t):
    i=int(t*hop); return float(a[max(0,min(len(a)-1,i))])
def sm(a,t,w=4):
    i=int(t*hop); return float(a[max(0,i-w):i+1].mean())
# paper
rng=np.random.default_rng(1)
paper=np.full((H,W,3),(243,236,220),np.float32)
paper+=rng.normal(0,6,(H,W,1)); 
paper=Image.fromarray(paper.clip(0,255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",96)
INK=(30,28,35)
def wob_poly(cx,cy,r,seed,n=40,amp=0.06,rx=1,ry=1,rot=0):
    R=random.Random(seed); pts=[]
    ph=[R.uniform(0,6.28) for _ in range(3)]
    for k in range(n+1):
        a=2*math.pi*k/n
        rr=r*(1+amp*math.sin(3*a+ph[0])+amp*0.6*math.sin(5*a+ph[1])+R.uniform(-amp,amp)*0.5)
        x=rr*math.cos(a)*rx; y=rr*math.sin(a)*ry
        pts.append((cx+x*math.cos(rot)-y*math.sin(rot), cy+x*math.sin(rot)+y*math.cos(rot)))
    return pts
def sketch_line(d,pts,seed,w=5,col=INK,passes=2):
    R=random.Random(seed)
    for p in range(passes):
        q=[(x+R.uniform(-2,2),y+R.uniform(-2,2)) for x,y in pts]
        d.line(q,fill=col,width=w if p==0 else max(2,w-2),joint="curve")
sparks=[]
for fi in range(int(DUR*FPS)):
    t=T0+fi/FPS
    boil=fi//2  # 12fps "boil" like hand animation
    L=sm(low,t); Hh=sm(hi,t,2); E=sm(rms,t,8)
    db=t-beats[beats<=t][-1] if (beats<=t).any() else 9
    bi=int((beats<=t).sum())
    kick=math.exp(-db*7)
    img=paper.copy(); d=ImageDraw.Draw(img,"RGBA")
    # background hatching moving with energy
    R=random.Random(boil*7)
    for k in range(18):
        y=(k*80+ (t*40)%80)
        d.line([(R.uniform(-40,0),y+R.uniform(-6,6)),(W+R.uniform(0,40),y+40+R.uniform(-6,6))],fill=(200,190,170,120),width=3)
    cx,cy=W/2,H*0.47
    s=1+0.18*kick+0.1*L
    # rays on hi
    R=random.Random(boil)
    for k in range(16):
        a=k/16*6.28+t*0.3
        r1=260*s; r2=r1+60+180*Hh*R.uniform(0.6,1.2)
        sketch_line(d,[(cx+r1*math.cos(a),cy+r1*math.sin(a)),(cx+r2*math.cos(a+0.05),cy+r2*math.sin(a+0.05))],boil*31+k,w=4)
    # cabbage: layered leaves
    greens=[(120,170,70),(150,195,90),(178,214,120),(205,230,155),(225,240,185)]
    for layer,g in enumerate(greens):
        nl=7-layer//2; rr=(210-layer*36)*s
        for k in range(nl):
            a=k/nl*6.28+layer*0.5+math.sin(t*2+layer)*0.08
            lx=cx+rr*0.45*math.cos(a); ly=cy+rr*0.45*math.sin(a)
            pts=wob_poly(lx,ly,rr*0.62,boil*100+layer*10+k,amp=0.07,rx=1.0,ry=0.75,rot=a)
            d.polygon(pts,fill=g+(255,))
            sketch_line(d,pts,boil*13+layer*7+k,w=5)
            # vein
            sketch_line(d,[(lx,ly),(lx+rr*0.4*math.cos(a),ly+rr*0.4*math.sin(a))],boil+k+layer,w=3,passes=1)
    # face
    blink = (bi%8==0 and db<0.15)
    for ex in (-38,38):
        if blink: sketch_line(d,[(cx+ex-14,cy-20),(cx+ex+14,cy-20)],boil+ex,w=5)
        else:
            e=wob_poly(cx+ex,cy-20,13+4*kick,boil+ex,n=16,amp=0.08); d.polygon(e,fill=INK)
    m=20+30*E
    sketch_line(d,[(cx-m,cy+22),(cx,cy+22+10+18*kick),(cx+m,cy+22)],boil+5,w=5)
    # cheeks
    for ex in (-70,70):
        d.ellipse([cx+ex-18,cy+5,cx+ex+18,cy+25],fill=(240,120,120,110))
    # sparks on beats
    if db<1/FPS*1.01 :
        R2=random.Random(bi)
        for _ in range(3+int(4*E)):
            a=R2.uniform(0,6.28); sparks.append([cx+330*math.cos(a),cy+330*math.sin(a)*1.2,t,R2.choice(["star","x","circle"]),R2.randint(0,999)])
    alive=[]
    for sp in sparks:
        age=t-sp[2]
        if age>0.6: continue
        alive.append(sp); sz=(18+40*age)*(1-age/0.6*0.5); x,y=sp[0],sp[1]-60*age
        if sp[3]=="star":
            pts=[]
            for k in range(11):
                rr=sz if k%2==0 else sz*0.45; a=k/10*6.28-1.57
                pts.append((x+rr*math.cos(a),y+rr*math.sin(a)))
            d.polygon(pts,fill=(255,200,60)); sketch_line(d,pts,boil+sp[4],w=4)
        elif sp[3]=="x":
            sketch_line(d,[(x-sz,y-sz),(x+sz,y+sz)],boil+sp[4],w=5); sketch_line(d,[(x-sz,y+sz),(x+sz,y-sz)],boil+sp[4]+1,w=5)
        else:
            sketch_line(d,wob_poly(x,y,sz*0.7,boil+sp[4],n=18),boil,w=4)
    sparks=alive
    # title, letters jumping on beats
    txt="КАПУСТКА"; R=random.Random(boil*3)
    total=sum(d.textlength(c,font=font) for c in txt); x=(W-total)/2
    for i,c in enumerate(txt):
        jump=-30*kick if (i%2==bi%2) else 0
        y=H*0.80+jump+R.uniform(-3,3); ang=R.uniform(-6,6)
        tw=int(d.textlength(c,font=font))+20
        li=Image.new("RGBA",(tw,130),(0,0,0,0)); ld=ImageDraw.Draw(li)
        ld.text((10,5),c,font=font,fill=(200,60,60) if i%3==0 else INK,stroke_width=3,stroke_fill=INK)
        li=li.rotate(ang,resample=Image.BICUBIC)
        img.paste(li,(int(x),int(y)),li); x+=d.textlength(c,font=font)
    # paper grain overlay vignette
    img.save(f"frames/f{fi:04d}.png")
