#!/usr/bin/env python3
"""Gemini 에셋 생성기. 팀이 docs/design/asset-requests/*.json 에 요청을 PR로 올리고 main에 머지되면
.github/workflows/gen-assets.yml 이 이 스크립트를 돌려 결과를 main에 커밋한다. (클라우드 루틴은 외부 API 접근이 막혀 있어 Actions가 대신 호출)

요청 파일(객체 또는 배열):
  { "id": "tori-idle",              # 필수, 결과 파일 이름. 이미 만든 id는 건너뜀("regen": true 면 다시 만듦)
    "type": "image" | "critique",   # 기본 image
    "prompt": "...",                # 필수
    "refs": ["docs/design/x.png"],  # 참조 이미지(저장소 경로)
    "model": "gemini-3-pro-image",  # image 기본 gemini-3.1-flash-image(초안), 최종은 gemini-3-pro-image
    "aspect": "1:1",                # 1:1 3:4 9:16 16:9 등
    "key": "none|green|magenta",    # 단색 배경 제거. 옷·소품 색과 겹치지 않는 색을 고른다
    "size": 512,                    # 긴 변 최대 px (기본 1024)
    "out": "public/art/tori-idle.webp"   # 기본 public/art/<id>.webp, critique 는 docs/design/critiques/<id>.md
  }
예산: 실행당 MAX_PER_RUN(12), 월 MAX_PER_MONTH(150) 장. 장부는 docs/design/asset-ledger.json.
"""
import base64, glob, io, json, os, sys, time, urllib.request, urllib.error
from datetime import datetime, timezone, timedelta

ROOT = os.getcwd()
REQ_DIR = os.path.join(ROOT, 'docs/design/asset-requests')
LEDGER = os.path.join(ROOT, 'docs/design/asset-ledger.json')
KEY = os.environ.get('GEMINI_API_KEY', '').strip()
MAX_RUN = int(os.environ.get('MAX_PER_RUN', '12'))
MAX_MONTH = int(os.environ.get('MAX_PER_MONTH', '150'))
API = 'https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent'
kst_month = (datetime.now(timezone.utc) + timedelta(hours=9)).strftime('%Y-%m')

def load_ledger():
    if os.path.exists(LEDGER):
        d = json.load(open(LEDGER))
    else:
        d = {}
    d.setdefault('items', {})
    if d.get('month') != kst_month:
        d['month'], d['count'] = kst_month, 0
    return d

def call(model, parts, image_out, aspect):
    body = {'contents': [{'parts': parts}]}
    if image_out:
        body['generationConfig'] = {'responseModalities': ['IMAGE'], 'imageConfig': {'aspectRatio': aspect}}
    req = urllib.request.Request(API.format(model), data=json.dumps(body).encode(),
                                 headers={'x-goog-api-key': KEY, 'content-type': 'application/json'})
    last = None
    for attempt in range(3):
        try:
            return json.load(urllib.request.urlopen(req, timeout=240))
        except urllib.error.HTTPError as e:
            last = f'{e.code} {e.read().decode()[:300]}'
            if e.code in (429, 500, 503):
                time.sleep(8 * (attempt + 1)); continue
            break
        except Exception as e:  # noqa
            last = str(e); time.sleep(5)
    raise RuntimeError(last)

def ref_parts(refs):
    parts = []
    for r in refs or []:
        p = os.path.join(ROOT, r)
        mime = 'image/png' if p.lower().endswith('.png') else 'image/webp' if p.lower().endswith('.webp') else 'image/jpeg'
        parts.append({'inlineData': {'mimeType': mime, 'data': base64.b64encode(open(p, 'rb').read()).decode()}})
    return parts

def process(raw, key, size):
    from PIL import Image
    import numpy as np
    im = Image.open(io.BytesIO(raw)).convert('RGBA')
    if key in ('green', 'magenta'):
        a = np.array(im).astype(np.int16)
        r, g, b = a[..., 0], a[..., 1], a[..., 2]
        soft = (g - np.maximum(r, b)) if key == 'green' else (np.minimum(r, b) - g)
        alpha = np.where(soft > 90, 0, np.where(soft > 35, np.clip(255 - (soft - 35) * 4.5, 0, 255), 255))
        a[..., 3] = alpha
        sp = (soft > 0) & (alpha < 255)
        if key == 'green':
            a[..., 1] = np.where(sp, np.maximum(r, b), g)
        else:
            m = g + np.maximum(0, (np.maximum(r, b) - g)) // 4
            a[..., 0] = np.where(sp, np.minimum(r, m + 20), r)
            a[..., 2] = np.where(sp, np.minimum(b, m + 20), b)
        im = Image.fromarray(a.astype(np.uint8))
        bb = im.getbbox()
        if bb:
            im = im.crop(bb)
        w, h = im.size
        s = max(w, h)
        can = Image.new('RGBA', (s, s), (0, 0, 0, 0))
        can.paste(im, ((s - w) // 2, (s - h) // 2))
        im = can
    if max(im.size) > size:
        k = size / max(im.size)
        im = im.resize((round(im.size[0] * k), round(im.size[1] * k)), Image.LANCZOS)
    out = io.BytesIO()
    im.save(out, 'WEBP', quality=86, method=6)
    return out.getvalue()

def main():
    if not KEY:
        print('GEMINI_API_KEY 없음: 건너뜀'); return 0
    files = sorted(glob.glob(os.path.join(REQ_DIR, '*.json')))
    ledger = load_ledger()
    todo = []
    for f in files:
        data = json.load(open(f))
        for rq in (data if isinstance(data, list) else [data]):
            if not rq.get('id') or not rq.get('prompt'):
                print('잘못된 요청(건너뜀):', f); continue
            if rq['id'] in ledger['items'] and not rq.get('regen'):
                continue
            todo.append(rq)
    done = 0
    for rq in todo:
        if done >= MAX_RUN:
            print(f'실행당 한도 {MAX_RUN}장 도달: 나머지는 다음 실행'); break
        if ledger['count'] >= MAX_MONTH:
            print(f'월 한도 {MAX_MONTH} 도달: 중단'); break
        t = rq.get('type', 'image')
        try:
            if t == 'critique':
                model = rq.get('model', 'gemini-3.1-pro-preview')
                d = call(model, ref_parts(rq.get('refs')) + [{'text': rq['prompt']}], False, '1:1')
                text = ''.join(p.get('text', '') for p in d['candidates'][0]['content']['parts'])
                out = rq.get('out', f'docs/design/critiques/{rq["id"]}.md')
                os.makedirs(os.path.dirname(os.path.join(ROOT, out)), exist_ok=True)
                open(os.path.join(ROOT, out), 'w').write(f'# 평가: {rq["id"]}\n\n모델: {model}\n\n{text}\n')
            else:
                model = rq.get('model', 'gemini-3.1-flash-image')
                d = call(model, ref_parts(rq.get('refs')) + [{'text': rq['prompt']}], True, rq.get('aspect', '1:1'))
                raw = next(base64.b64decode(p['inlineData']['data']) for p in d['candidates'][0]['content']['parts'] if 'inlineData' in p)
                out = rq.get('out', f'public/art/{rq["id"]}.webp')
                os.makedirs(os.path.dirname(os.path.join(ROOT, out)), exist_ok=True)
                open(os.path.join(ROOT, out), 'wb').write(process(raw, rq.get('key', 'none'), int(rq.get('size', 1024))))
            ledger['items'][rq['id']] = {'out': out, 'model': model, 'at': datetime.now(timezone.utc).isoformat(timespec='seconds')}
            ledger['count'] += 1; done += 1
            print('생성:', rq['id'], '→', out)
        except Exception as e:  # noqa
            print('실패:', rq['id'], str(e)[:300])
    os.makedirs(os.path.dirname(LEDGER), exist_ok=True)
    json.dump(ledger, open(LEDGER, 'w'), ensure_ascii=False, indent=2)
    print(f'이번 달 사용 {ledger["count"]}/{MAX_MONTH}장')
    return 0

if __name__ == '__main__':
    sys.exit(main())
