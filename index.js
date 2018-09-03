const ctx = require('fc')(render, true)
const center = require('ctx-translate-center')
const glmatrix = require('gl-matrix')
const renderGrid = require('ctx-render-grid-lines')
const vec2 = glmatrix.vec2
const mat3 = glmatrix.mat3
const segseg = require('segseg')
const ndarray = require('ndarray')
const raySlab = require('ray-aabb-slab')
const camera = require('ctx-camera')(ctx, window, {})

const grid = ndarray(new Float32Array(265), [16, 16])
const cellRadius = 5

const brickAABB = [
  [-8 * cellRadius, -8 * cellRadius],
  [ 8 * cellRadius,  8 * cellRadius]
]

const lineTo = ctx.lineTo.bind(ctx)
const moveTo = ctx.moveTo.bind(ctx)
const floor = Math.floor

const view = mat3.create()
const model = mat3.create()
const v2tmp = vec2.create()
const v2tmp2 = vec2.create()
const v2dir = vec2.create()
const v2offset = vec2.create()
const v2gridPos = vec2.create()
fillBrick()


// camera
const v2tmpCam = vec2.create()
const eye = [-100, 0]
const origin = [0, 0]
function cameraLookAt(mat, eye, target) {
  vec2.subtract(v2tmpCam, target, eye)
  mat3.identity(mat)

  const rot = Math.atan2(v2tmpCam[1], v2tmpCam[0])
  mat3.translate(mat, mat, eye)
  mat3.rotate(mat, mat, rot)
}

// TODO: locate active cell + dda through the grid

function render() {
    ctx.clear()
    camera.begin()
      center(ctx)
      ctx.scale(2.0, 2.0)

      ctx.save()
        ctx.lineWidth = 0.05
        ctx.beginPath()
          renderGrid(
            ctx,
            cellRadius,
            -cellRadius * 2 * 50,
            -cellRadius * 2 * 50,
            cellRadius * 2 * 50,
            cellRadius * 2 * 50
          )
          ctx.strokeStyle = '#AAA'
          ctx.stroke()

        ctx.lineWidth += 0.7
        ctx.strokeStyle = "#aaa"
        ctx.strokeRect(
          -grid.shape[0]/2 * cellRadius,
          -grid.shape[1]/2 * cellRadius,
          grid.shape[0] * cellRadius,
          grid.shape[0] * cellRadius
        )
      ctx.restore()
      drawBrick()

      // draw a circle at 0, 0
      ctx.beginPath()
        ctx.arc(0, 0, 0.5, 0, Math.PI*2, false)
        ctx.fillStyle = "#aaa"
        ctx.fill()

    const now = Date.now()
    vec2.set(eye,
      Math.sin(now / 1000) * 200,
      Math.cos(now / 1000) * 200
    )
    //vec2.set(eye, -100, 100)

    cameraLookAt(view, eye, origin)
    vec2.subtract(v2dir, origin, eye)
    vec2.normalize(v2dir, v2dir)
    vec2.set(v2tmp, 1 / v2dir[0], 1 / v2dir[1])
    var res = vec2.create()
    raySlab(eye, v2tmp, brickAABB, res)
    ctx.strokeStyle = "#4eb721"
    var isect = false
    // if the ray completely misses don't bother marching the grid
    if (isFinite(res[0])) {
      vec2.set(v2gridPos, eye[0] + v2dir[0] * res[0], eye[1] + v2dir[1] * res[0])
      isect = marchGrid(v2gridPos, v2dir)
    }

    if (!isFinite(res[0]) || !isect) {
      ctx.strokeStyle = "#d65757"
      res[0] = 6000
      vec2.set(v2gridPos, eye[0] + v2dir[0] * res[0], eye[1] + v2dir[1] * res[0])
    } else {
      ctx.strokeStyle = "#4eb721"
    }


    ctx.beginPath()
      ctx.moveTo(eye[0], eye[1])
      ctx.lineTo(v2gridPos[0], v2gridPos[1])
      ctx.stroke()

    ctx.strokeStyle = "#4eb721"
    ctx.fillStyle = "#367c17"
    drawCamera()



    camera.end();
}

function drawBrick() {

  const inVec = [0, 0]
  const txVec = [0, 0]

  vec2.set(v2offset, brickAABB[0][0], brickAABB[0][1])
  for (var x = 0; x<grid.shape[0]; x++) {
    inVec[0] = x
    for (var y = 0; y<grid.shape[1]; y++) {
      inVec[1] = y

      var d = grid.get(x, y)
      // TODO: transform each coord
      if (d > 0) {
        ctx.fillStyle = "#445"
      } else {
        ctx.fillStyle = "#aaa"
      }
      ctx.fillRect(
        v2offset[0] + x*cellRadius+1,
        v2offset[1] + y*cellRadius+1,
        cellRadius-2,
        cellRadius-2
      )
    }
  }
}

function fillBrick() {

  const inVec = [0, 0]
  const txVec = [0, 0]
  var r = grid.shape[0] / 2
  for (var x = 0; x<grid.shape[0]; x++) {
    inVec[0] = x
    for (var y = 0; y<grid.shape[1]; y++) {
      inVec[1] = y

      var d = vec2.length(
        vec2.set(
          v2tmp,
          (x - r),
          (y - r)
        )
      ) - r + 4 ;
      grid.set(x, y, d)

      // TODO: transform each coord
      ctx.fillStyle = "#d65757"
      ctx.fillRect(
        v2offset[0] + x*cellRadius+1,
        v2offset[1] + y*cellRadius+1,
        cellRadius-2,
        cellRadius-2
      )
    }
  }
}


function tx(mat, x, y, fn) {
    vec2.set(v2tmp, x, y)
    vec2.transformMat3(v2tmp, v2tmp, mat)
    fn(v2tmp[0], v2tmp[1])
}

function drawCamera() {
  ctx.beginPath()
    tx(view, -5, -5, moveTo)
    tx(view, +5, -5, lineTo)
    tx(view, +5, +5, lineTo)
    tx(view, -5, +5, lineTo)
    tx(view, -5, -5, lineTo)

    tx(view, +5,  +2, moveTo)
    tx(view, +10, +5, lineTo)
    tx(view, +10, -5, lineTo)
    tx(view, +5,  -2, lineTo)

    ctx.stroke()
    ctx.fill()
}

const v2sign = vec2.create()
function sign(out, v) {
  return vec2.set(
    out,
    Math.sign(v[0]),
    Math.sign(v[1])
  )
}

function invert(v) {
  if (v == 0) {
    return 0
  }
  return 1.0 / v;
}

function marchGrid(worldPos, dir) {
  ctx.lineWidth = 0.5

  var worldToBrick = [
    worldPos[0] - brickAABB[0][0],
    worldPos[1] - brickAABB[0][1]
  ]


  var gridPos = [
    floor((worldPos[0] - brickAABB[0][0]) / cellRadius + dir[0] * 0.5),
    floor((worldPos[1] - brickAABB[0][1]) / cellRadius + dir[1] * 0.5)
  ]

  var gridStep = sign(vec2.create(), sign(v2sign, dir))
  var invDir = [invert(dir[0]), invert(dir[1])]

  // grid space
  var corner = vec2.fromValues(
    Math.max(gridStep[0], 0.0),
    Math.max(gridStep[1], 0.0)
  )

  var mask = vec2.create();
  var ratio = vec2.create();
  vec2.set(
    ratio,
    (gridPos[0] - worldToBrick[0] / cellRadius) * invDir[0],
    (gridPos[1] - worldToBrick[1] / cellRadius) * invDir[1]
  )

  var ratioStep = vec2.multiply(vec2.create(), gridStep, invDir);

  // dda
  for (var i = 0.0; i < 64; i++ ) {
    if (gridPos[0] < 0 || gridPos[0] >= grid.shape[0] || gridPos[1] < 0 || gridPos[1] >= grid.shape[1]) {
      return false;
    }
    if (grid.get(gridPos[0], gridPos[1]) <= 0.0) {
      ctx.strokeStyle = "red"
      ctx.strokeRect(
        (brickAABB[0][0] + gridPos[0] * cellRadius + 1),
        (brickAABB[0][1] + gridPos[1] * cellRadius + 1),
        cellRadius-2,
        cellRadius-2
      )
      return true
    }
    ctx.strokeStyle = "#4eb721"
    ctx.strokeRect(
      brickAABB[0][0] + gridPos[0] * cellRadius + 1,
      brickAABB[0][1] + gridPos[1] * cellRadius + 1,
      cellRadius-2,
      cellRadius-2
    )

    vec2.set(mask, (ratio[0] <= ratio[1])|0, (ratio[1] <= ratio[0])|0)
    vec2.add(gridPos, gridPos, vec2.multiply(v2tmp, gridStep, mask))
    vec2.add(ratio, ratio, vec2.multiply(v2tmp, ratioStep, mask))
  }

  return false
}

/*
float march(in out vec3 pos, vec3 dir, out vec3 normal, out float iterations) {
  // grid space
  vec3 gridPos = floor(pos);
  vec3 grid_step = sign( dir );
  vec3 corner = max( grid_step, vec3( 0.0 ) );
  bvec3 mask;

  // ray space
  vec3 inv = vec3( 1.0 ) / dir;
  vec3 ratio = ( gridPos + corner - pos ) * inv;
  vec3 ratio_step = grid_step * inv;

  // dda
  float hit = -1.0;
  iterations = 0.0;
  for (float i = 0.0; i < ITERATIONS; i++ ) {
    if (hit > 0.0 || voxel( gridPos ) > 0.0) {
      hit = 1.0;
	  break;
    }
    iterations++;

    mask = lessThanEqual(ratio.xyz, min(ratio.yzx, ratio.zxy));
    grid += ivec3(grid_step) * ivec3(mask);
    pos += grid_step * ivec3(mask);
    ratio += ratio_step * vec3(mask);
  }

  vec3 d = abs(vec3((grid) + 0.5) - pos);

  normal = iterations == 0.0 ? vec3(greaterThan(d.xyz, max(d.yzx, d.zxy))) : vec3(mask);
  return hit;
}
*/
