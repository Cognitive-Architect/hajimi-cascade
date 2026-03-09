;; simhash-simd.wat - B-01: WASM SIMD SimHash (≤300行)
;; SIMD指令加速汉明距离和popcnt计算

(module
  ;; 64KB内存
  (memory (export "memory") 1)
  
  ;; === 汉明距离计算 (SIMD) ===
  ;; query_ptr, candidate_ptr -> distance (0-128)
  (func (export "hamming_distance") (param $q i32) (param $c i32) (result i32)
    (local $xor v128)
    local.get $q
    v128.load
    local.get $c
    v128.load
    v128.xor
    local.tee $xor
    i8x16.popcnt
    local.tee $xor
    i64x2.extract_lane 0
    local.get $xor
    i64x2.extract_lane 1
    i64.add
    i32.wrap_i64
  )
  
  ;; === 批量汉明距离 ===
  ;; query, candidates[], count, results[]
  (func (export "batch_distance")
    (param $q i32) (param $cand i32) (param $n i32) (param $out i32)
    (local $i i32) (local $cp i32) (local $op i32)
    i32.const 0
    local.set $i
    local.get $cand
    local.set $cp
    local.get $out
    local.set $op
    (block $break
      (loop $loop
        local.get $i
        local.get $n
        i32.ge_u
        br_if $break
        local.get $op
        local.get $q
        local.get $cp
        call $hamming_internal
        i32.store
        local.get $cp
        i32.const 16
        i32.add
        local.set $cp
        local.get $op
        i32.const 4
        i32.add
        local.set $op
        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $loop
      )
    )
  )
  
  ;; 内部汉明距离
  (func $hamming_internal (param $a i32) (param $b i32) (result i32)
    (local $x v128)
    local.get $a
    v128.load
    local.get $b
    v128.load
    v128.xor
    local.tee $x
    i8x16.popcnt
    local.tee $x
    i64x2.extract_lane 0
    local.get $x
    i64x2.extract_lane 1
    i64.add
    i32.wrap_i64
  )
  
  ;; === 候选过滤 (距离<=阈值) ===
  ;; 返回匹配数量
  (func (export "filter_candidates")
    (param $q i32) (param $cand i32) (param $n i32) 
    (param $thresh i32) (param $matches i32) (result i32)
    (local $i i32) (local $mc i32) (local $cp i32) (local $mp i32) (local $d i32)
    i32.const 0
    local.set $i
    i32.const 0
    local.set $mc
    local.get $cand
    local.set $cp
    local.get $matches
    local.set $mp
    (block $break
      (loop $loop
        local.get $i
        local.get $n
        i32.ge_u
        br_if $break
        local.get $q
        local.get $cp
        call $hamming_internal
        local.set $d
        local.get $d
        local.get $thresh
        i32.le_u
        (if
          (then
            local.get $mp
            local.get $i
            i32.store
            local.get $mp
            i32.const 4
            i32.add
            local.set $mp
            local.get $mc
            i32.const 1
            i32.add
            local.set $mc
          )
        )
        local.get $cp
        i32.const 16
        i32.add
        local.set $cp
        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $loop
      )
    )
    local.get $mc
  )
  
  ;; === 哈希比较 ===
  (func (export "hash_equals") (param $a i32) (param $b i32) (result i32)
    (local $v v128)
    local.get $a
    v128.load
    local.get $b
    v128.load
    v128.eq
    local.tee $v
    i64x2.all_true
  )
  
  ;; === 快速路径: JS回退检测 ===
  ;; 检测浏览器是否支持SIMD
  (func (export "simd_supported") (result i32)
    ;; 总是返回1，实际检测在loader中
    i32.const 1
  )
)
