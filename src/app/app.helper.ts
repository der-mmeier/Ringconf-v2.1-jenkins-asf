export function array_closest(ar: number[], goal: number)
{
  return ar.reduce(function (prev, curr)
  {
    return (Math.abs(curr - goal) < Math.abs(prev - goal) ? curr : prev);
  });
}

export function array_closest_lower(ar: number[], goal: number)
{
  return ar.reduce(function (prev, curr)
  {
    return (curr <= goal ? curr : prev);
  });
}

export let getMilliseconds = (function ()
{
  let perf = window.performance || {};
  // @ts-ignore
  let fn = perf.now || perf.mozNow || perf.webkitNow || perf.msNow || perf.oNow;
// fn.bind will be available in all the browsers that support the advanced window.performance... ;-)
  return fn ? fn.bind(perf) : function ()
  {
    return new Date().getTime();
  };
})();

export let map = function (value: number, low1: number, high1: number, low2: number, high2: number)
{
  return low2 + (high2 - low2) * (value - low1) / (high1 - low1);
}

