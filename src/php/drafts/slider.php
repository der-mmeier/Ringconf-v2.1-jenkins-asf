<style>
  body {
    /*margin: 0;*/
  }

  .slider-component {
    position:relative;
    width:480px;
    padding:20px 0;
    border: 1px solid #000;
  }

  .slider-wrapper {
    position: relative;
    /*top: 100px;*/
    width: 100%;
    height: 32px;
    user-select: none;
  }

  .slider-bg {
    background-color: #aaa;
  }


  .slider-handle-wrapper {
    width: 1px;
    height: 52px;
    position: absolute;
    top: 0;
    font-size: 11px;
  }

  .slider-value {
    position: absolute;
    bottom: calc(100% + 2px);
    width: auto;
    overflow: hidden;
    text-align: center;
    pointer-events: none;
    touch-action: none;
    line-height: 12px;
    background: #0f0;
    color: #000;
    padding: 2px;
    border-radius: 3px;
    transform: translateX(calc(-50% + 1px));
  }

  .slider-line {
    position: absolute;
    top: 0;
    width: 2px;
    height: 32px;
    background: #000;
  }

  .slider-index {
    position: absolute;
    bottom: 0;
    width: 20px;
    height: 20px;
    left: -9px;
    text-align: center;
    cursor: pointer;
    background: url(mts-handle.svg) no-repeat;
    background-size: 20px 20px;
    color: #000;
    line-height: 23px;
  }

  .slider-handle-wrapper.disabled {
    pointer-events: none;
    touch-action: none;
    -ms-touch-action: none;
    -webkit-touch-callout: none;
  }

  .slider-handle-wrapper.disabled .slider-index {
    background-image: url(mts-handle-disabled.svg);
    color: #fff;
  }

</style>
<div class="slider-component">
<div class="slider-wrapper">
  <canvas class="slider-bg" width="480" height="32"></canvas>
  <!--
  die Segment-/Ringbreite innerhalb des Canvas anzeigen. 5.0mm...2.5mm | 2,5mm
  -->

    <div class="slider-handle-wrapper disabled" style="left:50%">
      <div class="slider-value">12.99</div>
      <div class="slider-line"></div>
      <div class="slider-index">1</div>
    </div>

    <div class="slider-handle-wrapper" style="left:25%">
      <div class="slider-value">1.0</div>
      <div class="slider-line"></div>
      <div class="slider-index">0</div>
    </div>

</div>
</div>
