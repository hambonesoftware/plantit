"""Author connected conservatory rooms as anisotropic 3D Gaussian primitives.
Images supply color; geometry/depth is authored, not multi-view reconstruction.
Output: standard 32-byte .splat, plus camera anchors in scene-manifest.json.
"""
from pathlib import Path
from PIL import Image
import numpy as np,json,math,struct,random
ROOT=Path(__file__).resolve().parents[1]
random.seed(842)
qidentity=[1,0,0,0]
def quat(axis,angle):
 s=math.sin(angle/2);return [math.cos(angle/2),axis[0]*s,axis[1]*s,axis[2]*s]
def write_room(idx,texture):
 pts=[]
 def add(x,y,z,sx,sy,sz,col,alpha=235,q=qidentity):
  if min(sx,sy,sz)<=0:raise ValueError('Positive Gaussian scales required')
  pts.append(([x,y,z],[sx,sy,sz],[int(max(0,min(255,c))) for c in col]+[alpha],q))
 # Rear wall, photographic color over a physical wall surface. Leaf regions
 # project forward at varied depth, giving genuine parallax during approach.
 im=np.array(Image.open(ROOT/'assets'/texture).convert('RGB').resize((240,144)))
 for v in range(144):
  for u in range(240):
   rgb=im[v,u].astype(float);green=rgb[1]>rgb[0]*1.04 and rgb[1]>rgb[2]*1.14
   x=(u+.5)/240*10-5;y=(1-(v+.5)/144)*6.4
   depth=.10+(.38+.24*math.sin(u*.13)*math.sin(v*.09) if green else 0)
   add(x,y,-6+depth,.028,.030,.012 if not green else .045,rgb,245)
 # Floor is a patterned plane of actual Gaussians, receding in depth.
 for ix in range(95):
  for iz in range(100):
   x=-5+(ix+.5)*10/95;z=-6+(iz+.5)*11/100
   grout=ix%19==0 or iz%20==0
   tone=(177 if grout else 210)+random.uniform(-5,5)
   add(x,-.03,z,.078,.014,.079,[tone,tone*.96,tone*.85],250)
 # Side walls: doorway openings share z=1.0 so camera never crosses solid wall.
 for side in [-1,1]:
  for iy in range(66):
   y=(iy+.5)*6.4/66
   for iz in range(95):
    z=-6+(iz+.5)*11/95
    if -.25<z<2.25 and y<3.2:continue
    tone=220+random.uniform(-4,4)
    add(side*5,y,z,.015,.068,.079,[tone,tone*.963,tone*.87],245)
  # Wooden doorway trim and lintel; actual open doorway, not a wall cutout image.
  for y in np.linspace(0,3.25,85):
   for z in [-.28,2.28]:add(side*4.96,y,z,.055,.035,.055,[157,138,98],245)
  for z in np.linspace(-.28,2.28,62):add(side*4.96,3.25,z,.06,.05,.03,[166,146,105],245)
 # Conservatory roof beams.
 for z in [-5.8,-3.1,-.3,2.5,4.8]:
  for x in np.linspace(-5,5,155):add(x,6.35,z,.047,.045,.045,[181,166,128],240)
 for x in [-4.9,0,4.9]:
  for z in np.linspace(-6,5,145):add(x,6.35,z,.043,.045,.055,[181,166,128],240)
 # Freestanding 3D leafy plants. Separate Gaussian leaves, stems and pots
 # retain their shape as the camera moves; no plant-photo billboards.
 anchors=[[-2.85,0,-2.5],[0,0,-3.15],[2.85,0,-2.5]]
 def stem(a,b,r=.018):
  a=np.array(a);b=np.array(b);length=np.linalg.norm(b-a)
  for t in np.linspace(0,1,max(5,int(length/.028))):
   p=a*(1-t)+b*t;add(*p,r,.032,r,[73,103,49],240)
 def leaf(origin,theta,length,width,droop=0):
  # Each curved leaf is a surface sampled by oriented ellipsoids.
  ox,oy,oz=origin;dx,dz=math.cos(theta),math.sin(theta)
  for j in range(1,26):
   t=j/25;cx=ox+dx*length*t;cy=oy+.32*math.sin(t*math.pi)-droop*t*t;cz=oz+dz*length*t
   w=width*math.sin(math.pi*t)**.7
   for k in range(-5,6):
    a=k/5;vein=abs(k)<1
    color=[68+idx*3,109+idx*4,46+idx*3] if not vein else [123,151,69]
    add(cx-dz*w*a,cy+.045*(1-a*a),cz+dx*w*a,.029,.014,.034,color,235,quat([0,1,0],theta))
 for pi,base in enumerate(anchors):
  bx,_,bz=base
  # Terra-cotta pots, varying elliptical radius by height.
  for yi in range(23):
   y=yi*.028;rad=.29+.14*yi/22
   for th in np.linspace(0,math.tau,75):
    shade=.85+.15*math.sin(th+.7)
    add(bx+rad*math.cos(th),y,bz+rad*math.sin(th),.028,.025,.028,[172*shade,121*shade,79*shade],250)
  for th in np.linspace(0,math.tau,100):add(bx+.445*math.cos(th),.65,bz+.445*math.sin(th),.034,.04,.034,[191,148,103],250)
  for j in range(400):
   rad=random.random()**.5*.4;th=random.random()*math.tau
   add(bx+rad*math.cos(th),.635,bz+rad*math.sin(th),.033,.012,.033,[75,65,40],250)
  if pi==0:
   # Large split-leaf-inspired tropical silhouette.
   for k in range(12):
    theta=k*2.4+idx*.3;h=1.0+(k%4)*.38
    tip=[bx+math.cos(theta)*.43,h,bz+math.sin(theta)*.43]
    stem([bx,.65,bz],tip);leaf(tip,theta,.7+(k%3)*.18,.26)
  elif pi==1:
   # Tall trailing heart-shaped foliage trained on a moss pole.
   stem([bx,.65,bz],[bx,2.45,bz],.045)
   for k in range(19):
    th=k*2.4;h=.8+k*.085;ori=[bx+math.cos(th)*.12,h,bz+math.sin(th)*.12]
    leaf(ori,th,.55,.18,droop=.13)
  else:
   # Arching fern fronds with many fine leaflets in real depth.
   for k in range(17):
    th=k*2.4;ln=.75+(k%4)*.12
    for j in range(1,18):
     t=j/18;cx=bx+math.cos(th)*ln*t;cz=bz+math.sin(th)*ln*t;cy=.7+.9*math.sin(t*2.1)
     add(cx,cy,cz,.018,.025,.018,[93,133,52],245)
     width=.23*math.sin(t*math.pi)
     for sign in [-1,1]:
      for s in np.linspace(.1,1,6):
       add(cx+math.cos(th+sign*1.2)*width*s,cy+.04*s,cz+math.sin(th+sign*1.2)*width*s,.033,.013,.026,[90,137,50],230)
 # Cascading foliage close to the camera makes translation visible.
 for side in [-1,1]:
  for k in range(9):
   x=side*(4.45+random.random()*.35);z=-5+k*1.12;top=5.9
   for j in range(22):
    y=top-j*.105;xx=x+.12*math.sin(j*.55+k)
    add(xx,y,z,.018,.07,.018,[88,115,54],235)
    if j%3==0:leaf([xx,y,z],k+j*.8,.32,.11,droop=.12)
 out=ROOT/'assets/scenes'/f'room-{idx}.splat'
 with out.open('wb') as f:
  for pos,scale,col,q in pts:
   f.write(struct.pack('<6f',*pos,*scale));f.write(bytes(col));f.write(bytes(round(max(0,min(255,128+v*128))) for v in q))
 print(out.name,len(pts),'gaussians',out.stat().st_size,'bytes')
 return {'name':['Sunroom','Vine House','Fern Alcove'][idx],'file':f'assets/scenes/room-{idx}.splat','offset':[idx*10,0,0],'home':{'position':[idx*10,2.05,4.2],'target':[idx*10,2.1,-3]},'plants':[{'id':i,'position':[idx*10+a[0]+.1,1.8,a[2]+2.25],'target':[idx*10+a[0],1.45,a[2]]} for i,a in enumerate(anchors)],'gaussians':len(pts)}
rooms=[write_room(i,n) for i,n in enumerate(['sanctuary.jpg','vine-house.jpg','fern-alcove.jpg'])]
(ROOT/'assets/scenes/manifest.json').write_text(json.dumps({'format':'splat-32','geometry':'authored','reconstructed':False,'rooms':rooms},indent=2))
