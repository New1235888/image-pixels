'use strict'

var t = require('tape')
var fs = require('fs')
var path = require('path')
var getPixels = require('../')
var match = require('pixelmatch')
var s2ab = require('string-to-arraybuffer')
var fixture = require('./fixture')
var ab2s = require('arraybuffer-to-string')
var x = require('object-assign')
var a = require('assert')
var getNdPixels = require('get-pixels')
var isOnline = require('is-online')
var isBrowser = require('is-browser')

var clipFix = {
  data: [
    0,255,255,255,     255,255,255,255,
    255,255,255,255,   255,255,255,255
  ],
  width: 2,
  height: 2
}
var pngFixData = s2ab(fixture.pngDataURL)
var pngFixURL = fixture.pngURL

const ASSERT_N = 17
const REQUEST_TIMEOUT = 3000


// strings
t('absolute path', async t => {
  t.plan(ASSERT_N)
  await testSource(t, path.resolve('./test/test_pattern.png'))
  t.end()
})
t('relative path', async t => {
  t.plan(ASSERT_N)
  await testSource(t, './test/test_pattern.png')
  t.end()
})
t('some path', async t => {
  t.plan(ASSERT_N)
  await testSource(t, 'test/test_pattern.png')
  t.end()
})
t('https', async t => {
  if (await online()) {
    t.plan(ASSERT_N)
    await testSource(t, pngFixURL)
  }

  t.end()
})
t('http', async t => {
  if (await online()) {
    t.plan(ASSERT_N)
    await testSource(t, pngFixURL.replace('https', 'http'))
  }

  t.end()
})
t('protocol-relative URL', async t => {
  if (await online()) {
    t.plan(ASSERT_N)
    await testSource(t, pngFixURL.replace('https:', ''))
  }

  t.end()
})
t('data URL', async t => {
  t.plan(2 * ASSERT_N)
  await testSource(t, fixture.pngDataURL)
  await testSource(t, fixture.jpgDataURL)
  t.end()
})
t('base64', async t => {
  t.plan(ASSERT_N)
  await testSource(t, fixture.pngDataURL.replace(/^data:image\/(png|jpg);base64,/, ''))
  t.end()
})
t('raw pixels base64', async t => {
  t.plan(ASSERT_N)
  await testSource(t, ab2s(fixture.data, 'base64'), {w:16, h:8})
  t.end()
})

// DOMs
t(`<img>`, async t => {
  if (!isBrowser) return t.end()

  t.plan(ASSERT_N)
  let img = document.createElement('img')
  img.src = './test/test_pattern.png'
  await testSource(t, img)
  t.end()
})
t(`<image>`, async t => {
  if (!isBrowser) return t.end()
  t.plan(ASSERT_N)
  let el = document.createElement('div')
  el.innerHTML = `<svg width="200" height="200"
  xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image xlink:href="./test/test_pattern.png"/>
  </svg>
  `
  let img = el.firstChild.firstChild
  await testSource(t, img)
  t.end()
})
t(`<video>`, async t => {
  if (!isBrowser) return t.end()
  t.plan(ASSERT_N)
  let el = document.createElement('div')
  el.innerHTML = `<video src="./test/stream_of_water.webm"></video>`

  await testSource(t, el.firstChild, null, {
    width: 480, height: 360
  })

  t.end()
})
t(`Image`, async t => {
  if (!isBrowser) return t.end()
  t.plan(ASSERT_N)
  let img = new Image
  img.src = './test/test_pattern.png'
  await testSource(t, img)
  t.end()
})
t(`ImageData`, async t => {
  if (!isBrowser) return t.end()
  t.plan(ASSERT_N)
  var context = document.createElement('canvas').getContext('2d')
  var idata = context.createImageData(fixture.width, fixture.height)
  for (var i = 0; i < fixture.data.length; i++) {
    idata.data[i] = fixture.data[i]
  }

  await testSource(t, idata)
  t.end()
})
t(`ImageBitmap`, async t => {
  if (!isBrowser) return t.end()
  t.plan(ASSERT_N * 2)
  var canvas = fixture.canvas2d
  let bm = createImageBitmap(canvas)
  await testSource(t, bm)

  bm = await createImageBitmap(canvas)
  await testSource(t, bm)

  t.end()
})
t(`File, Blob`, async t => {
  if (!isBrowser) return t.end()
  t.plan(ASSERT_N * 2)

  await testSource(t, new File([pngFixData], 'file.png'))
  await testSource(t, new Blob([pngFixData]))

  t.end()
})
t(`Canvas/Context2D`, async t => {
  if (!isBrowser) return t.end()
  t.plan(ASSERT_N * 2)
  var canvas = fixture.canvas2d
  await testSource(t, canvas)

  var canvas = fixture.canvas2d
  await testSource(t, canvas.getContext('2d'))
  t.end()
})
t(`Canvas/WebGLContext`, async t => {
  if (isBrowser) {
    t.plan(ASSERT_N * 3)
    await testSource(t, fixture.gl)
    await testSource(t, fixture.canvasGl)
  }
  else {
    t.plan(ASSERT_N * 2)
    await testSource(t, fixture.gl)
  }
  await testSource(t, fixture.regl)

  t.end()
})

// buffers
t(`Buffer`, async t => {
  t.plan(ASSERT_N + 1)

  var buf = new Buffer(fixture.data)
  try {
    await getPixels(new Buffer(fixture.data))
  } catch (e) {
    t.ok(e)
  }

  await testSource(t, buf, {width: fixture.width, height: fixture.height})
  t.end()
})
t(`ArrayBuffer`, async t => {
  t.plan(ASSERT_N + 1)
  try {
    await getPixels(fixture.data.buffer)
  } catch (e) {
    t.ok(e)
  }

  await testSource(t, fixture.data.buffer, {width: fixture.width, height: fixture.height})
  t.end()
})
t(`Uint8Array`, async t => {
  t.plan(ASSERT_N + 1)
  try {
    await getPixels(fixture.data)
  } catch (e) {
    t.ok(e)
  }

  await testSource(t, fixture.data, {width: fixture.width, height: fixture.height})
  t.end()
})
t(`Uint8Array encoded`, async t => {
  t.plan(ASSERT_N)
  await testSource(t, new Uint8Array(pngFixData))
  t.end()
})
t(`Uint8ClampedArray`, async t => {
  t.plan(ASSERT_N + 1)
  try {
    await getPixels(new Uint8ClampedArray(fixture.data))
  } catch (e) {
    t.ok(e)
  }

  await testSource(t, new Uint8ClampedArray(fixture.data), {width: fixture.width, height: fixture.height})
  t.end()
})
t(`Float32Array`, async t => {
  t.plan(ASSERT_N + 1)

  var arr = new Float32Array(fixture.data.length)
  for (let i = 0; i < arr.length; i++) {
    arr[i] = fixture.data[i] / 255
  }

  try {
    await getPixels(arr)
  } catch (e) {
    t.ok(e)
  }

  await testSource(t, arr, {width: fixture.width, height: fixture.height})
  t.end()
})
t(`Float64Array`, async t => {
  t.plan(ASSERT_N + 1)

  var arr = new Float64Array(fixture.data.length)
  for (let i = 0; i < arr.length; i++) {
    arr[i] = fixture.data[i] / 255
  }

  try {
    await getPixels(arr)
  } catch (e) {
    t.ok(e)
  }

  await testSource(t, arr, {width: fixture.width, height: fixture.height})
  t.end()
})
t(`Array`, async t => {
  t.plan(ASSERT_N + 1)

  var arr = Array.from(fixture.data)

  try {
    await getPixels(arr)
  } catch (e) {
    t.ok(e)
  }

  await testSource(t, arr, {width: fixture.width, height: fixture.height})
  t.end()
})
t(`[[r,g,b,a], [r,g,b,a], ...]`, async t => {
  t.plan(ASSERT_N + 1)

  // [[r,g,b,a], [r,g,b,a], ...]
  var arr = Array(fixture.data.length / 4)
  for (let i = 0; i < arr.length; i++) {
    arr[i] = [
      fixture.data[4 * i + 0],
      fixture.data[4 * i + 1],
      fixture.data[4 * i + 2],
      fixture.data[4 * i + 3]
    ]
  }

  try {
    await getPixels(arr)
  } catch (e) {
    t.ok(e)
  }

  await testSource(t, arr, {width: fixture.width, height: fixture.height})
  t.end()
})
t('[[r,g,b,a,r,g,b,a], [r,g,b,a,r,g,b,a], ...]', async t => {
  t.plan(ASSERT_N + 1)

  // [[r,g,b,a], [r,g,b,a], ...]
  var arr = []
  for (let y = 0; y < fixture.height; y++) {
    var row = []
    for (let i = 0; i < fixture.width; i++) {
      row.push(fixture.data[y * fixture.width * 4 + i * 4])
      row.push(fixture.data[y * fixture.width * 4 + i * 4 + 1])
      row.push(fixture.data[y * fixture.width * 4 + i * 4 + 2])
      row.push(fixture.data[y * fixture.width * 4 + i * 4 + 3])
    }
    arr.push(row)
  }

  try {
    await getPixels(arr)
  } catch (e) {
    t.ok(e)
  }

  await testSource(t, arr, {width: fixture.width, height: fixture.height})
  t.end()
})
t('[[[r,g,b,a], [r,g,b,a]], [[r,g,b,a], [r,g,b,a]], ...]', async t => {
  t.plan(ASSERT_N + 1)

  // [[r,g,b,a], [r,g,b,a], ...]
  var arr = []
  for (let y = 0; y < fixture.height; y++) {
    var row = []
    for (let i = 0; i < fixture.width; i++) {
      row.push([
        fixture.data[y * fixture.width * 4 + i * 4],
        fixture.data[y * fixture.width * 4 + i * 4 + 1],
        fixture.data[y * fixture.width * 4 + i * 4 + 2],
        fixture.data[y * fixture.width * 4 + i * 4 + 3]
      ])
    }
    arr.push(row)
  }

  try {
    await getPixels(arr)
  } catch (e) {
    t.ok(e)
  }

  await testSource(t, arr, {width: fixture.width, height: fixture.height})
  t.end()
})


// cases
t(`options directly`, async t => {
  t.plan(ASSERT_N)
  await testSource(t, {source: fixture.pngDataURL})
  t.end()
})
t(`ndarray`, async t => {
  t.plan(ASSERT_N)

  getNdPixels(fixture.pngDataURL, async (e, px) => {
    await testSource(t, px)
    t.end()
  })
})


t(`multiple sources: list`, async t => {
  t.plan(8)

  // different sources list
  let list = await getPixels.all([
    fixture.data,
    fixture.pngDataURL,
    fixture.pngURL,
    fixture.gl
  ], {width: fixture.width, height: fixture.height})

  t.ok(list[0].data instanceof Uint8Array)
  t.ok(list[1].data instanceof Uint8Array)
  t.ok(list[2].data instanceof Uint8Array)
  t.ok(list[3].data instanceof Uint8Array)

  t.equal(match(list[0].data, fixture.data, null, fixture.width, fixture.height, {threshold: .006}), 0, 'Ok data pixels')
  t.equal(match(list[1].data, fixture.data, null, fixture.width, fixture.height, {threshold: .006}), 0, 'Ok data pixels')
  t.equal(match(list[2].data, fixture.data, null, fixture.width, fixture.height, {threshold: .006}), 0, 'Ok data pixels')
  t.equal(match(list[3].data, fixture.data, null, fixture.width, fixture.height, {threshold: .006}), 0, 'Ok data pixels')

  t.end()
})

t('multiple sources: dict', async t => {
  t.plan(3)

  // different source dict
  let {a, b, c} = await getPixels.all({
    a: fixture.data,
    b: fixture.pngDataURL,
    c: fixture.pngURL
  }, {width: fixture.width, height: fixture.height})

  t.deepEqual(fixture.data, a.data)
  t.deepEqual(fixture.data, b.data)
  t.deepEqual(fixture.data, c.data)

  t.end()
})

t('multiple source error', async t => {
  t.plan(2)

  await getPixels.all([
    fixture.data,
    fixture.pngDataURL,
    fixture.canvas
  ]).catch(e => {
    t.ok(e)
  })
  await getPixels.all({
    a: fixture.data,
    b: fixture.pngDataURL,
    c: fixture.canvas
  }).catch(e => {
    t.ok(e)
  })

  t.end()
})
t('<picture>', async t => {
  if (!isBrowser) return t.end()

  t.plan(ASSERT_N)
  let el = document.createElement('div')
  el.innerHTML = `<picture>
    <source srcset="${fixture.jpgDataURL}">
    <img src="${fixture.pngDataURL}">
  </picture>`
  await testSource(t, el.firstChild)
  t.end()
})
t('bad string', async t => {
  t.plan(1)
  try {
    await getPixels('')
  } catch (e) {
    t.ok(e)
  }

  t.end()
})
t('not existing url', async t => {
  t.plan(1)
  try {
    await getPixels('./test/xxx.png')
  } catch (e) {
    t.ok(e)
  }

  t.end()
})
t('not an image url', async t => {
  t.plan(1)
  try {
    await getPixels('./test/fixture.js')
  } catch (e) {
    t.ok(e)
  }

  t.end()
})


// TODO
// decode
t('png')
t('jpg')
t('gif')
t('bmp')
t.skip('#img-el', async t => {
})
t.skip('changed URL contents', async t => {
  // TODO: create tmp file, rewrite it
})
t.skip('URL timeout')
t.skip('bad URL data')
t.skip('malformed encoded buffer')
t.skip(`File, Blob encoded data`, async t => {
  t.plan(ASSERT_N * 2)

  await testSource(t, new File([fixture.data], 'file.png'))
  await testSource(t, new Blob([fixture.data]))

  t.end()
})
t.skip('SourceBuffer')
t.skip('SourceBufferList')
t.skip(`MediaSource`, async t => {
  t.plan(ASSERT_N)

  var mediaSource = new MediaSource()
  var video = new HTMLVideoElement()
  video.src = URL.createObjectURL(mediaSource)
  mediaSource.addEventListener('sourceopen', function () {
    mediaSource.addSourceBuffer(mimeCodec)
  })

  // await testSource(t, new)

  t.end()
})
t.skip(`OffscreenCanvas, bitmaprenderer`, async t => {
  t.plan(ASSERT_N * 2)

  let offscreen = new OffscreenCanvas(fixture.width, fixture.height)
  let context = offscreen.getContext('webgl')

  // ... some drawing for the first canvas using the gl context ...

  // Commit rendering to the first canvas
  var bm = offscreen.transferToImageBitmap()

  one.transferImageBitmap(bm);
})


// get-pixels cases
function test_image (t, pixels) {
  t.equal(match(pixels.data, fixture.data, null, fixture.width, fixture.height, {threshold: 0}), 0)
  // t.deepEqual(pixels.data, fixture.data)
}
t('get-pixels', async function(t) {
  getPixels('test/lena.png', function(err, pixels) {
    if(err) {
      t.fail(err)
    } else {
      t.equals([pixels.width, pixels.height].join(','), '512,512')
    }
    t.end()
  })
})

t('get-pixels-png', async function(t) {
  getPixels('test/test_pattern.png', function(err, pixels) {
    if(err) {
      t.error(err, 'failed to parse png')
      t.end()
      return
    }
    test_image(t, pixels)
    t.end()
  })
})

t.skip('get-pixels-ppm', async function(t) {
  getPixels(path.join(__dirname, 'test_pattern.ppm'), function(err, pixels) {
    if(err) {
      t.error(err, 'failed to parse ppm')
      t.end()
      return
    }
    test_image(t, pixels)
    t.end()
  })
})

t('get-pixels-gif', async function(t) {
  getPixels('test/test_pattern.gif', function(err, pixels) {
    if(err) {
      t.error(err, 'failed to parse gif')
      t.end()
      return
    }
    test_image(t, pixels)
    t.end()
  })
})

t('get-pixels-bmp', async function(t) {
  getPixels('test/test_pattern.bmp', function(err, pixels) {
    if(err) {
      t.error(err, 'failed to parse bmp')
      t.end()
      return
    }
    test_image(t, pixels)
    t.end()
  })
})

t('data url', async function(t) {
  var url = 'data:image/gif;base64,R0lGODlhEAAQAMQAAORHHOVSKudfOulrSOp3WOyDZu6QdvCchPGolfO0o/XBs/fNwfjZ0frl3/zy7////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACH5BAkAABAALAAAAAAQABAAAAVVICSOZGlCQAosJ6mu7fiyZeKqNKToQGDsM8hBADgUXoGAiqhSvp5QAnQKGIgUhwFUYLCVDFCrKUE1lBavAViFIDlTImbKC5Gm2hB0SlBCBMQiB0UjIQA7'
  getPixels(url, function(err, data) {
    if(err) {
      console.log(err)
      t.error('failed to read data url')
      t.end()
      return
    }
    t.ok(true, 'data url opened without crashing')
    t.end()
  })
})

t('get-pixels-buffer', async function(t) {
  var buffer = fs.readFileSync(__dirname + '/test_pattern.png')
  getPixels(buffer, 'image/png', function(err, pixels) {
    if(err) {
      t.error(err, 'failed to parse buffer')
      t.end()
      return
    }
    test_image(t, pixels)
    t.end()
  })
})

t('get-url png img', async function(t) {
  if (!(await online())) return t.end()

  var url = 'https://raw.githubusercontent.com/dy/get-pixel-data/master/test/test_pattern.png';
  getPixels(url, function(err, pixels){
    if(err) {
      console.log('Error:', err);
      t.error(err, 'failed to read web image data');
      t.end();
      return;
    }
    test_image(t, pixels);
    t.end();
  });
});

t('get-url gif img', async function(t) {
  if (!(await online())) return t.end()

  var url = 'https://raw.githubusercontent.com/dy/get-pixel-data/master/test/test_pattern.gif';
  getPixels(url, function(err, pixels){
    if(err) {
      console.log('Error:', err);
      t.error(err, 'failed to read web image data');
      t.end();
      return;
    }
    test_image(t, pixels);
    t.end();
  });
});


async function testSource(t, arg, o, fix=fixture) {
  // direct
  let to = setTimeout(function () {t.fail('Direct timeout')}, REQUEST_TIMEOUT)
  let data = await getPixels(arg, o)
  clearTimeout(to)

  t.equal(data.width, fix.width)
  t.equal(data.height, fix.height)
  // for (var i = 0; i < fix.data.length; i++) {
  //   var val = fix.data[i]
  //   if (fix.data[i] != data.data[i]) console.log(i, fix.data[i], data.data[i])
  // }
  fix.data ?
  t.equal(match(data.data, fix.data, null, fix.width, fix.height, {threshold: .006}), 0, 'Ok async pixels') :
  t.ok(data.data[0], 'Ok async pixels')

  // second time (cache)
  to = setTimeout(function () {t.fail('Direct second timeout')}, REQUEST_TIMEOUT)
  let data2 = await getPixels(arg, o)
  clearTimeout(to)
  t.deepEqual(data.data, data2.data)
  t.equal(data2.width, fix.width)
  t.equal(data2.height, fix.height)
  fix.data ? t.equal(match(data2.data, fix.data, null, fix.width, fix.height, {threshold: .006}), 0, 'Ok async pixels twice') :
  t.ok(data2.data[0], 'Ok async pixels twice')

  // clip
  to = setTimeout(function () {t.fail('Clip timeout')}, REQUEST_TIMEOUT)
  let clip = await getPixels(arg, x({clip: [1,1,3,3]}, o))
  clearTimeout(to)

  t.equal(clip.width, 2)
  t.equal(clip.height, 2)
  fix.data ?
  t.equal(match(clip.data, clipFix.data, null, 2, 2, {threshold: .006}), 0, 'Ok clip pixels') :
  t.ok(clip.data[0], 'Ok clip pixels')

  // alltogether
  to = setTimeout(function () {t.fail('All timeout')}, REQUEST_TIMEOUT)
  var list = await getPixels.all([
    o,
    x({clip: [1,1,3,3]}, o)
  ], {source: arg})
  clearTimeout(to)

  t.deepEqual(data.data, list[0].data, 'Ok all pixels data')
  t.equal(list[0].width, fix.width)
  t.equal(list[0].height, fix.height)
  fix.data ? t.equal(match(list[0].data, fix.data, null, fix.width, fix.height, {threshold: .006}), 0, 'Ok all pixels') :
  t.ok(list[0].data[0], 'Ok all pixels')

  t.equal(list[1].width, 2)
  t.equal(list[1].height, 2)
  fix.data ?
  t.equal(match(list[1].data, clipFix.data, null, 2, 2, {threshold: .006}), 0, 'Ok clip pixels') :
  t.ok(list[1].data[0], 'Ok all clip pixels')
}

async function online () {
  if (isOnline.call) {
    isOnline = await isOnline()
  }
  return isOnline
}
