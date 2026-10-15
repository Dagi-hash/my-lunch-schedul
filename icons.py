from PIL import Image, ImageDraw
def make(size, scale, path):
    S = 2048
    im = Image.new('RGB', (S, S), (0, 0, 0)); d = ImageDraw.Draw(im)
    cw, ch = 900*scale, 1000*scale; x0 = (S-cw)/2; y0 = (S-ch)/2; r = 150*scale
    d.rounded_rectangle([x0-5, y0-5, x0+cw+5, y0+ch+5], r+5, fill=(60, 60, 60))
    d.rounded_rectangle([x0, y0, x0+cw, y0+ch], r, fill=(22, 22, 22))
    d.rounded_rectangle([x0, y0, x0+cw, y0+ch/2], r, fill=(34, 34, 34))
    d.rectangle([x0, y0+ch/2-r, x0+cw, y0+ch/2], fill=(34, 34, 34))
    d.rectangle([x0, y0+ch/2, x0+cw, y0+ch/2+r], fill=(22, 22, 22))
    d.rectangle([x0-6, y0+ch/2-9*scale, x0+cw+6, y0+ch/2+9*scale], fill=(0, 0, 0))
    w = int(95*scale); cx = S/2; cy = S/2
    pts = [(cx-230*scale, cy+10*scale), (cx-55*scale, cy+195*scale), (cx+250*scale, cy-190*scale)]
    d.line(pts, fill=(255, 255, 255), width=w, joint='curve')
    for p in (pts[0], pts[2]):
        d.ellipse([p[0]-w/2, p[1]-w/2, p[0]+w/2, p[1]+w/2], fill=(255, 255, 255))
    im.resize((size, size), Image.LANCZOS).save(path)
make(192, 1.0, 'icons/icon-192.png'); make(512, 1.0, 'icons/icon-512.png')
make(512, 0.62, 'icons/maskable-512.png'); make(180, 1.0, 'icons/apple-touch-icon.png'); make(32, 1.0, 'icons/favicon-32.png')
