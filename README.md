# Güvercin Besle 3D

## Çalıştırma

Node.js 18 veya üzeri gerekir.

```powershell
npm install
npm start
```

Tarayıcıda `http://localhost:3000` adresini aç. Oyundaki **Online** düğmesinden oda oluşturup bağlantıyı arkadaşlarınla paylaşabilir veya oda koduyla katılabilirsin. Aynı odada en fazla 8 oyuncu bulunabilir.

## Online sürümün kapsamı

Sunucu oyuncu konumlarını, sahip oldukları güvercinlerin hareketlerini ve kümes seviyelerini oda içinde gerçek zamanlı iletir. Diğer oyuncuların kümeleri kendi kümelerinin çevresinde görünür. Kısa ağ kesintilerinde istemci aynı odaya otomatik yeniden bağlanmayı dener. Oda sunucu belleğinde tutulur; sunucu kapanınca odalar ve bağlantılar silinir. Yıldızlar, kümes ilerlemesi ve açık artırma şu an her oyuncunun kendi kayıt alanındadır; ortak sunucu ekonomisi değildir.

Kuş satmak için kendi kuşunu **H** ile (mobilde **Kuş al** düğmesiyle) tut, **Kuş Satış** alanına götürüp bırak. Normal kuşlar 8⭐, nadir kuşlar 25⭐ verir; yabani kuşlar satılamaz.

**Market** düğmesinden veya **M** tuşuyla marketi açıp yem torbasını büyütebilir, yem alabilir ve Kaya Güvercini, Taklacı veya Posta Güvercini satın alabilirsin. Diğer türler markette satışa sunulmaz.

## İnternette arkadaşlarla oynama

Sunucu, Render gibi Node.js ve WebSocket destekleyen bir web servisine dağıtılmaya hazırdır. `render.yaml` Render Blueprint ayarlarını içerir.

1. Projeyi kendi GitHub hesabında **private** bir depoya yükle.
2. Render'da **New > Blueprint** seçip bu depoyu bağla ve dağıtımı başlat.
3. Render'ın verdiği `https://...onrender.com` adresini aç. Oyunda **Online** düğmesinden oda oluşturup çıkan davet bağlantısını uzaktaki arkadaşına gönder.

Oda sunucu belleğinde tutulur; sunucu yeniden başlatılırsa odadaki oyuncuların yeniden bağlanması gerekir. Ücretsiz Render hizmeti 15 dakika trafik olmazsa uykuya geçer ve tekrar açılması yaklaşık bir dakika sürebilir. Kesintisiz açık kalması için ücretli bir sunucu planı gerekir. Yıldızlar, kümes ilerlemesi ve açık artırma oyuncular arasında paylaşılmaz; her oyuncunun kendi kayıt alanında kalır.
