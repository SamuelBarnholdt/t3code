// This document is installed once. Updates reconcile runs so streaming does not
// reload the WebView or recreate completed equations and open source disclosures.
// The content's flow root contains display margins, so height measurements
// include the scrollbar instead of clipping it below the native view.
export const NATIVE_MATH_DOCUMENT = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:"><style>
mjx-assistive-mml{position:absolute!important;clip:rect(1px,1px,1px,1px);padding:1px 0 0 0!important;border:0!important;display:block!important;width:auto!important;overflow:hidden!important;user-select:none!important}*{box-sizing:border-box}html,body{margin:0;padding:0;background:transparent}body{font-family:-apple-system,system-ui,sans-serif;overflow-wrap:anywhere}#content{display:flow-root;white-space:pre-wrap}a{color:inherit}.inline-icon{display:inline-block;width:14px;height:14px;vertical-align:-2px;margin-right:4px;user-select:none;-webkit-user-select:none}.display{display:block;margin:1em 0;min-width:0;white-space:normal}.viewport{display:block;overflow-x:auto;padding:.5em 0}.table-viewport{display:block;overflow-x:auto;max-width:100%}td,th{overflow-wrap:anywhere}.display .equation{display:block;width:max-content;min-width:100%;max-width:none;overflow:visible;text-align:center}.equation{display:inline-block;max-width:100%;overflow-x:auto;overflow-y:hidden;vertical-align:middle;padding-block:.2em;white-space:nowrap}.inline-scroll-shell{display:inline-block;max-width:100%;vertical-align:middle}.math-scrollbar{display:block;height:6px;margin-top:5px;border-radius:3px;background:color-mix(in srgb,currentColor 16%,transparent);position:relative;overflow:hidden}.math-scrollbar[hidden]{display:none}.math-scroll-thumb{display:block;position:absolute;height:100%;border-radius:3px;background:color-mix(in srgb,currentColor 55%,transparent)}.equation mjx-container{margin:0!important;direction:ltr}.equation svg{overflow:visible;min-width:1px;min-height:1px}.display .equation mjx-container{display:block;line-height:0}.display .equation svg{display:block;margin-inline:auto}.actions{display:flex;justify-content:flex-end;gap:14px;user-select:none;-webkit-user-select:none}button{font:12px system-ui;color:inherit;background:none;border:0;padding:6px 0}.source{display:block;white-space:pre-wrap;font:12px monospace;margin-top:8px}.source[hidden]{display:none}.file-menu{display:flex;flex-direction:column;align-items:flex-start;white-space:normal;border-block:1px solid currentColor;padding:4px 0}.file-actions{padding-inline:5px}button:focus-visible,.viewport:focus-visible,.equation:focus-visible{outline:1px solid currentColor}
</style></head><body><div id="content"></div><script>
(function(){
var revision=0, previous=[], root=document.getElementById('content');
function send(data){window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({revision:revision},data)));}
window.mathCopyResult=function(text){document.querySelectorAll('[data-copy]').forEach(function(button){if(button.getAttribute('data-copy')===text)button.textContent='Copied';});};
// iOS overlay scrollbars disappear at rest. Keep a position indicator beside
// overflowing equations and tables; scrolling itself stays native.
function updateScrollbar(viewport){
if(!viewport.matches('.viewport,.table-viewport,.equation')||(viewport.classList.contains('equation')&&viewport.closest('.display')))return;
var track=viewport.nextElementSibling;
if(!track||!track.classList.contains('math-scrollbar')){track=document.createElement('span');track.className='math-scrollbar';track.setAttribute('aria-hidden','true');var thumb=document.createElement('span');thumb.className='math-scroll-thumb';track.appendChild(thumb);viewport.after(track);}
var width=viewport.clientWidth,total=viewport.scrollWidth;
track.hidden=total<=width+1;
if(!track.hidden){track.style.width=width+'px';track.firstElementChild.style.width=(width/total*100)+'%';track.firstElementChild.style.left=(Math.max(0,Math.min(viewport.scrollLeft,total-width))/total*100)+'%';}
}
function measure(){root.querySelectorAll('.viewport,.table-viewport,.equation').forEach(updateScrollbar);send({type:'height',height:Math.ceil(document.body.getBoundingClientRect().height)});}
window.updateMath=function(update){
revision=update.revision;document.body.style.color=update.color;document.body.style.fontSize=update.fontSize+'px';document.body.style.lineHeight=update.lineHeight+'px';
update.runs.forEach(function(html,index){if(previous[index]===html)return;var child=root.children[index];if(!child){child=document.createElement('span');root.appendChild(child);}child.innerHTML=html;});
while(root.children.length>update.runs.length)root.lastElementChild.remove();previous=update.runs;observer.disconnect();observer.observe(document.body);root.querySelectorAll('.viewport,.table-viewport,.equation').forEach(function(node){observer.observe(node);});measure();
};
var observer=new ResizeObserver(measure);observer.observe(document.body);
document.addEventListener('scroll',function(event){if(event.target instanceof Element)updateScrollbar(event.target);},true);
document.addEventListener('keydown',function(event){if(event.key==='Escape'){var menu=document.querySelector('.file-menu');if(menu)menu.remove();}});
document.addEventListener('click',function(event){var old=document.querySelector('.file-menu');var target=event.target.closest('button,a');if(!target){if(old)old.remove();return;}
if(target.hasAttribute('data-menu')){var closing=old&&target.nextElementSibling===old;if(old)old.remove();if(closing)return;var menu=JSON.parse(target.getAttribute('data-menu'));var list=document.createElement('span');list.className='file-menu';list.setAttribute('role','menu');menu.actions.forEach(function(action){var button=document.createElement('button');button.textContent=action.title;button.disabled=!!action.disabled;button.setAttribute('role','menuitem');button.setAttribute('data-href',target.getAttribute('data-href'));button.setAttribute('data-action',action.id);list.appendChild(button);});target.after(list);return;}
if(target.hasAttribute('data-action')){send({type:'file-action',href:target.getAttribute('data-href'),action:target.getAttribute('data-action')});target.closest('.file-menu').remove();return;}
if(old)old.remove();
if(target.hasAttribute('data-copy')){send({type:'copy',text:target.getAttribute('data-copy')});return;}
if(target.hasAttribute('data-toggle')){var source=target.closest('.display').querySelector('.source');source.hidden=!source.hidden;target.textContent=source.hidden?'TeX source':'Hide source';target.setAttribute('aria-expanded',String(!source.hidden));return;}
if(target.tagName==='A'){event.preventDefault();send({type:'link',href:target.getAttribute('href')});}
});
document.addEventListener('copy',function(event){var selection=window.getSelection();if(!selection||!selection.rangeCount||selection.isCollapsed)return;
var range=selection.getRangeAt(0).cloneRange();function math(node){return (node.nodeType===1?node:node.parentElement).closest('.equation,[data-copy-source]');}
var start=math(range.startContainer),end=math(range.endContainer);if(start)range.setStartBefore(start);if(end)range.setEndAfter(end);
var fragment=document.createElement('div');fragment.appendChild(range.cloneContents());fragment.querySelectorAll('.actions,.file-actions,.file-menu,.inline-icon,.math-scrollbar').forEach(function(node){node.remove();});fragment.querySelectorAll('.source').forEach(function(node){var display=node.closest('.display');if(node.hidden||(display&&display.querySelector('.equation')))node.remove();});fragment.querySelectorAll('[data-copy-source]').forEach(function(node){node.replaceWith(document.createTextNode(node.getAttribute('data-copy-source')));});fragment.querySelectorAll('.equation').forEach(function(node){node.replaceWith(document.createTextNode(node.getAttribute('data-source')));});
Array.from(fragment.querySelectorAll('tr')).forEach(function(row,index){var text=Array.from(row.children).filter(function(cell){return cell.tagName==='TH'||cell.tagName==='TD';}).map(function(cell){return cell.textContent;}).join('\\t');row.replaceWith(document.createTextNode((index?'\\n':'')+text));});
event.preventDefault();send({type:'copy',text:fragment.textContent});
});
send({type:'ready'});
})();
</script></body></html>`;
