import json, random
from pathlib import Path
random.seed(4287)
rows=[
('Lapicero BP-S azul','Pilot','escritura',2.50,'unidad',1,None,None),
('Lapicero BP-S negro','Pilot','escritura',2.50,'unidad',1,None,None),
('Lapicero BP-S rojo','Pilot','escritura',2.50,'unidad',1,None,None),
('Lapicero Frixion Ball azul 0.7 mm','Pilot','escritura',11.90,'unidad',1,None,None),
('Bolígrafo Trilux 032 azul','Faber-Castell','escritura',1.90,'unidad',1,None,None),
('Bolígrafo Trilux 032 negro','Faber-Castell','escritura',1.90,'unidad',1,None,None),
('Lápiz de grafito 2B','Faber-Castell','escritura',1.30,'unidad',1,None,None),
('Lápiz de grafito HB','Artesco','escritura',0.80,'unidad',1,None,None),
('Borrador blanco grande','Artesco','escritura',1.00,'unidad',1,None,None),
('Resaltador Boss amarillo','Stabilo','escritura',7.50,'unidad',1,None,None),
('Resaltador Boss rosado','Stabilo','escritura',7.50,'unidad',1,None,None),
('Marcador permanente negro','Sharpie','escritura',6.90,'unidad',1,None,None),
('Plumón para pizarra azul','Artline','escritura',4.90,'unidad',1,None,None),
('Plumón para pizarra rojo','Artline','escritura',4.90,'unidad',1,None,None),
('Colores clásicos x12','Faber-Castell','arte',17.90,'caja',12,None,None),
('Colores bicolor x12','Artesco','arte',15.50,'caja',12,None,None),
('Plumones Fiesta x12','Faber-Castell','arte',13.90,'estuche',12,None,None),
('Plastilina x12 colores','Jovi','arte',12.90,'caja',12,None,None),
('Acuarelas escolares x12','Arti Creativo','arte',9.90,'estuche',12,None,None),
('Cuaderno A4 rayado 100 hojas','Standford','cuadernos',8.50,'unidad',1,None,None),
('Cuaderno A4 cuadriculado 100 hojas','Standford','cuadernos',8.50,'unidad',1,None,None),
('Cuaderno universitario espiral A4','Justus','cuadernos',11.90,'unidad',1,None,None),
('Cuaderno escolar A5 rayado','Norma','cuadernos',4.80,'unidad',1,None,None),
('Cuaderno escolar A5 cuadriculado','Norma','cuadernos',4.80,'unidad',1,None,None),
('Block arcoíris A4 20 hojas','Artesco','papel',6.90,'block',20,None,None),
('Papel bond A4 75 g/m² x500','Chamex','papel',19.90,'resma',500,75,'g/m²'),
('Papel bond A4 80 g/m² x500','Report','papel',22.90,'resma',500,80,'g/m²'),
('Papel de colores A4 x100 hojas','Artesco','papel',12.50,'paquete',100,None,None),
('Notas adhesivas 76×76 mm x100','Post-it','oficina',8.50,'block',100,None,None),
('Folder manila A4','Gallo','oficina',0.80,'unidad',1,None,None),
('Archivador palanca A4','Artesco','oficina',10.90,'unidad',1,None,None),
('Silicona líquida 100 ml','Artesco','pegamentos',2.70,'frasco',1,100,'ml'),
('Silicona líquida 250 ml','Artesco','pegamentos',4.90,'frasco',1,250,'ml'),
('Silicona líquida 250 ml','Vinifan','pegamentos',4.80,'frasco',1,250,'ml'),
('Goma escolar blanca 250 g','Artesco','pegamentos',5.90,'frasco',1,250,'g'),
('Pegamento en barra 21 g','UHU','pegamentos',8.90,'barra',1,21,'g'),
('Cinta adhesiva transparente 12 mm × 40 yd','Scotch','pegamentos',4.50,'rollo',1,None,None),
('Cinta de embalaje 48 mm × 40 yd','3M','pegamentos',6.50,'rollo',1,None,None),
('Calculadora científica fx-82MS','Casio','tecnologia',79.90,'unidad',1,None,None),
('Calculadora de escritorio de 12 dígitos','Casio','tecnologia',29.90,'unidad',1,None,None),
('Pilas alcalinas AA x2','Duracell','tecnologia',11.90,'blíster',2,None,None),
('Pilas alcalinas AAA x2','Duracell','tecnologia',11.90,'blíster',2,None,None),
('Tijera escolar punta roma','Maped','oficina',7.50,'unidad',1,None,None),
('Regla transparente 30 cm','Artesco','oficina',2.00,'unidad',1,None,None),
('Compás escolar metálico','Maped','oficina',15.90,'unidad',1,None,None),
('Corrector líquido 20 ml','Liquid Paper','oficina',5.90,'frasco',1,20,'ml'),
('Portaminas 0.5 mm','Paper Mate','escritura',8.90,'unidad',1,None,None),
('Rollerball Signo 0.7 mm azul','Uni-ball','escritura',9.50,'unidad',1,None,None),
]
branches=[]
colors=['#2abfe5','#f026ad','#b7a1ff','#f2c36f']
for i in range(1,5):
 branches.append({'id':f'sucursal-{i}','name':f'Sucursal {i:02d}','subtitle': ['Tu tienda de siempre','Ideas que toman forma','Todo para tus proyectos','Lo que buscas, más cerca'][i-1],'address':'Dirección por configurar','hours':'Lun a dom · Horario por confirmar','phone':'','accent':colors[i-1],'active':True,'order':i,'tag': ['Selección especial','Catálogo completo','Novedades','Para cada ocasión'][i-1]})
categories=[
{'id':'escritura','name':'Escritura','icon':'pen-tool','order':1},
{'id':'cuadernos','name':'Cuadernos','icon':'notebook','order':2},
{'id':'papel','name':'Papelería','icon':'files','order':3},
{'id':'pegamentos','name':'Pegamentos','icon':'layers','order':4},
{'id':'arte','name':'Arte y color','icon':'palette','order':5},
{'id':'oficina','name':'Oficina','icon':'briefcase','order':6},
{'id':'tecnologia','name':'Tecnología','icon':'calculator','order':7},
]
products=[]
offers=[]
for i,(name,brand,cat,price,unit,units,net,netunit) in enumerate(rows,1):
 pid=f'prod-{i:04}'
 products.append({'id':pid,'sku':f'LF-{i:05}','name':name,'brand':brand,'categoryId':cat,'description':f'{name}. Producto del catálogo {brand}, disponible sujeto a existencias.','unitLabel':unit,'unitsPerPack':units,'netContent':net,'netUnit':netunit,'imageUrl':'','isNew':i%6==0,'featured':i%4==0,'active':True,'order':i})
 for j,b in enumerate(branches):
  shift=[0,.02,-.035,.045][j]+(((i*7+j*5)%7)-3)*.008
  p=round(max(.5,price*(1+shift))*2)/2
  stock=[5,11,26,38,48,65,85,115,140][(i*7+j*3)%9]
  if i%13==0 and j==2: stock=0
  offers.append({'branchId':b['id'],'productId':pid,'price':p,'compareAt':round(p*1.19,2) if i%8==0 else None,'stock':stock,'minStock':5,'active':True})
campaigns=[
 {'id':'camp-navidad','title':'La magia empieza con una idea','eyebrow':'TEMPORADA NAVIDEÑA','description':'Pequeños detalles, grandes momentos. Encuentra todo para crear, decorar y compartir.','ctaLabel':'Explorar temporada','categoryId':'arte','accent':'#f026ad','background':'navidad','badge':'Especial de temporada','startDay':'11-01','endDay':'12-31','enabled':True,'branches':['all'],'priority':1},
 {'id':'camp-escolar','title':'Prepárate para un gran comienzo','eyebrow':'CAMPAÑA ESCOLAR','description':'Cuadernos, colores y todo lo esencial para una vuelta a clases con estilo.','ctaLabel':'Ver útiles escolares','categoryId':'cuadernos','accent':'#2abfe5','background':'escolar','badge':'Vuelta a clases','startDay':'01-02','endDay':'03-20','enabled':True,'branches':['all'],'priority':2},
 {'id':'camp-madre','title':'Detalles hechos con mucho amor','eyebrow':'DÍA DE LA MADRE','description':'Sorpréndela con materiales, tarjetas y creaciones especiales.','ctaLabel':'Ver ideas para regalar','categoryId':'arte','accent':'#ef93b7','background':'madre','badge':'Para mamá','startDay':'05-01','endDay':'05-15','enabled':True,'branches':['all'],'priority':3},
 {'id':'camp-halloween','title':'Una temporada de creatividad','eyebrow':'HALLOWEEN','description':'Colores, manualidades y muchas ideas para una celebración diferente.','ctaLabel':'Descubrir ideas','categoryId':'arte','accent':'#ff9b54','background':'halloween','badge':'Edición especial','startDay':'10-01','endDay':'11-02','enabled':True,'branches':['all'],'priority':4},
]
sections=[{'id':'beneficios','title':'Nuestros servicios','enabled':True,'order':1}, {'id':'categorias','title':'Explora por categoría','enabled':True,'order':2}, {'id':'destacados','title':'Los favoritos de tu sucursal','enabled':True,'order':3}, {'id':'novedades','title':'Recién llegados','enabled':True,'order':4}, {'id':'catalogo','title':'Catálogo completo','enabled':True,'order':5}]
settings={'businessName':'La Favorita','tagline':'Más que una librería...','announcement':'Encuentra tus favoritos en nuestras 4 sucursales','showProvisionalNotice':True,'primaryColor':'#f026ad','secondaryColor':'#26c4e7','heroHeadline':'CADA IDEA|CUENTA.','heroDescription':'Un universo de colores, creatividad y útiles para acompañarte en cada proyecto.'}
seed={'version':1,'branches':branches,'categories':categories,'products':products,'offers':offers,'campaigns':campaigns,'sections':sections,'settings':settings}
Path('/mnt/data/LaFavoritaWeb/data/seed.json').write_text(json.dumps(seed,ensure_ascii=False,indent=2),encoding='utf-8')
print(len(products),len(offers),len(campaigns))
