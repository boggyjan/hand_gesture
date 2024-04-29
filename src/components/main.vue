<template>
  <div>
    <!-- <button
      @click="enableCam()"
      :disable="hasGetUserMedia"
    >
      {{ webcamRunning ? 'Enable Webcam' : 'Disable Webcam' }}
    </button> -->

    <div class="cam">
      <div ref="visualEffectsContainer" class="visual-effects-container" />
      <video ref="video" autoplay playsinline></video>
      <canvas ref="canvas" width="1280" height="720"></canvas>
    </div>

    <p>{{ output }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { GestureRecognizer, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision'
import { gsap } from 'gsap'
import * as PIXI from 'pixi.js'
import { AdvancedBloomFilter } from 'pixi-filters'

const loading = ref(true)
let gestureRecognizer
const webcamRunning = ref(false)
const video = ref()
const canvas = ref()
let canvasCtx
const output = ref('')
const hasGetUserMedia = ref(false)
let lastVideoTime = -1
let results = undefined

// Visual Effects
const visualEffectsContainer = ref()
let hue = ref(Math.random() * 360)
let displacementSprite

// Before we can use HandLandmarker class we must wait for it to finish
// loading. Machine Learning models can be large and take a moment to
// get everything needed to run.
const createGestureRecognizer = async () => {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
  )
  gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-tasks/gesture_recognizer/gesture_recognizer.task',
      delegate: 'GPU'
    },
    runningMode: 'LIVE_STREAM',
    numHands: 2
  })
  loading.value = false
  enableCam()
}

// https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/latest/gesture_recognizer.task?v=alkali.mediapipestudio_20240314_0657_RC00

// https://storage.googleapis.com/mediapipe-assets/studio/prod/alkali.mediapipestudio_20240314_0657_RC00/vision_wasm_internal.wasm
createGestureRecognizer()

// Enable the live webcam view and start detection.
async function enableCam(event) {
  if (!gestureRecognizer) {
    alert('Please wait for gestureRecognizer to load')
    return
  }

  webcamRunning.value = !webcamRunning.value

  // getUsermedia parameters.
  const constraints = {
    video: true
  }

  // Activate the webcam stream.
  navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
    video.value.srcObject = stream
    // canvas
    video.value.addEventListener('loadeddata', predictWebcam)
  })
}

function predictWebcam() {
  let nowInMs = Date.now()

  if (video.value.currentTime !== lastVideoTime) {
    lastVideoTime = video.value.currentTime
    results = gestureRecognizer.recognizeForVideo(video.value, nowInMs)
  }

  canvasCtx.save()
  canvasCtx.clearRect(0, 0, canvas.value.width, canvas.value.height)
  const drawingUtils = new DrawingUtils(canvasCtx)

  // particle effects
  const template = new PIXI.Graphics()
  template.beginFill(`rgb(${HSLToRGB(hue.value, 90, 70).join(',')})`)
  template.drawCircle(0, 0, 4)
  template.endFill()

  if (results.landmarks) {
    for (const landmarks of results.landmarks) {
      drawingUtils.drawConnectors(
        landmarks,
        GestureRecognizer.HAND_CONNECTIONS,
        {
          color: '#FFFFFF',
          lineWidth: 1
        }
      )
      drawingUtils.drawLandmarks(
        landmarks,
        {
          color: '#FF0000',
          lineWidth: 1,
          radius (a) {
            const r = a.from.z * -40 + 1
            const rc = r > 0.2 ? r : 0.2
            return rc
          }
        }
      )

      landmarks.forEach(landmark => {
        for (let i = 0; i < 8; i++) {
          const x = landmark.x * window.innerWidth
          const x2 = Math.random() * 200 - 100 + x
          const y = landmark.y * window.innerHeight
          const y2 = Math.random() * 200 - 100 + y
          const s = Math.random() + 0.2
          const dot = { x, x2, y, y2, s }
          createParticle(template, { x, x2, y, y2, s })
        }
      })

      hue.value = Math.floor((hue.value + 1) % 360)
      displacementSprite.x++
    }
  }
  canvasCtx.restore()

  if (results.gestures.length > 0) {
    const categoryName = results.gestures[0][0].categoryName
    const categoryScore = parseFloat(
      results.gestures[0][0].score * 100
    ).toFixed(2)
    const handedness = results.handednesses[0][0].displayName
    output.value = `GestureRecognizer: ${categoryName}\n Confidence: ${categoryScore} %\n Handedness: ${handedness}`
  } else {
    output.value = ''
  }

  // Call this function again to keep predicting when the browser is ready.
  if (webcamRunning.value) {
    window.requestAnimationFrame(predictWebcam)
  }
}

let displacementEffectContainer

function HSLToRGB (h, s, l) {
  s /= 100
  l /= 100
  const k = n => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = n =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [255 * f(0), 255 * f(8), 255 * f(4)]
}

function createParticle (template, particle) {
  const circle = new PIXI.Graphics(template.geometry)
  circle.x = particle.x
  circle.y = particle.y
  circle.scale.x = particle.s
  circle.scale.y = particle.s
  circle.blendMode = PIXI.BLEND_MODES.ADD

  displacementEffectContainer.addChild(circle)

  const onComplete = function () {
    circle.destroy()
  }

  gsap.to(circle, { x: particle.x2, y: particle.y2, duration: 2, onComplete })
  gsap.to(circle.scale, { x: 0, y: 0, duration: 2 })
}

onMounted(() => {
  hasGetUserMedia.value = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
  canvasCtx = canvas.value.getContext('2d')

  // visual effects
  const ve = new PIXI.Application({ width: 100, height: 100 })

  window.addEventListener('resize', () => {
    setTimeout(() => {
      ve.renderer.resize(ve.view.clientWidth, ve.view.clientHeight)
    }, 500)
  })

  displacementEffectContainer = new PIXI.Container()
  ve.stage.addChild(displacementEffectContainer)

  visualEffectsContainer.value.appendChild(ve.view)
  ve.renderer.resize(ve.view.clientWidth, ve.view.clientHeight)

  // filter
  displacementSprite = PIXI.Sprite.from('/images/displacement_map_repeat.jpg')
  ve.stage.addChild(displacementSprite)

  displacementSprite.texture.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT
  const displacementFilter = new PIXI.DisplacementFilter(displacementSprite)
  displacementFilter.padding = 100
  displacementSprite.position = ve.stage.position
  displacementFilter.scale.x = 100
  displacementFilter.scale.y = 100
  displacementEffectContainer.filters = [displacementFilter]

  ve.stage.filters = [new AdvancedBloomFilter({ bloomScale: 4 })]

  const circle = new PIXI.Graphics()
  circle.beginFill('#000000')
  circle.drawCircle(0, 0, 1)
  circle.endFill()
  ve.stage.addChild(circle)
})
</script>

<style lang="scss">
body {
  background: #000;
}

.cam {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  transform: scaleX(-1);

  video {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.2;
  }

  canvas {
    display: block;
    position: absolute;
    left: 0px;
    top: 0px;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .visual-effects-container {
    position: absolute;
    left: 0px;
    top: 0px;
    width: 100%;
    height: 100%;
  }
}
</style>
