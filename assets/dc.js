/* DLA site runtime: renders the page template (sc-if, sc-for, {{holes}}) from the page's Component class. */
(function () {
  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(patch) {
      Object.assign(this.state, typeof patch === 'function' ? patch(this.state) : patch);
      schedule();
    }
  }
  window.DCLogic = DCLogic;
  var comp, tpl, app, queued = false;
  function schedule() { if (!queued) { queued = true; requestAnimationFrame(function () { queued = false; render(); }); } }
  var HOLE = /\{\{\s*([\w.$]+)\s*\}\}/g;
  function lookup(path, scope) {
    if (path === 'true') return true;
    if (path === 'false') return false;
    var parts = path.split('.'), v = scope;
    for (var i = 0; i < parts.length; i++) { if (v == null) return undefined; v = v[parts[i]]; }
    return v;
  }
  function exact(str, scope) {
    var m = /^\s*\{\{\s*([\w.$]+)\s*\}\}\s*$/.exec(str || '');
    return m ? lookup(m[1], scope) : undefined;
  }
  function fill(str, scope) {
    return str.replace(HOLE, function (_, p) { var v = lookup(p, scope); return v == null ? '' : String(v); });
  }
  function proc(node, scope, out) {
    if (node.nodeType === 3) { out.appendChild(document.createTextNode(fill(node.nodeValue, scope))); return; }
    if (node.nodeType !== 1) return;
    var tag = node.tagName.toLowerCase();
    if (tag === 'sc-if') {
      if (exact(node.getAttribute('value'), scope)) node.childNodes.forEach(function (c) { proc(c, scope, out); });
      return;
    }
    if (tag === 'sc-for') {
      var list = exact(node.getAttribute('list'), scope) || [], as = node.getAttribute('as') || 'item';
      list.forEach(function (item, i) {
        var s = Object.create(scope); s[as] = item; s.$index = i;
        node.childNodes.forEach(function (c) { proc(c, s, out); });
      });
      return;
    }
    var el = node.namespaceURI === 'http://www.w3.org/2000/svg'
      ? document.createElementNS(node.namespaceURI, node.tagName) : document.createElement(node.tagName);
    for (var i = 0; i < node.attributes.length; i++) {
      var a = node.attributes[i];
      if (/^on/i.test(a.name)) {
        var fn = exact(a.value, scope);
        if (typeof fn === 'function') el.addEventListener(a.name.slice(2).toLowerCase(), fn);
        continue;
      }
      el.setAttribute(a.name, fill(a.value, scope));
    }
    var kids = tag === 'template' ? node.content.childNodes : node.childNodes;
    kids.forEach(function (c) { proc(c, scope, el); });
    if (tag === 'textarea') el.value = el.textContent;
    out.appendChild(el);
  }
  function keyOf(el) { return el.id || el.name || ''; }
  function render() {
    var saved = {}, focusKey = document.activeElement && keyOf(document.activeElement);
    app.querySelectorAll('input, textarea, select').forEach(function (el) {
      var k = keyOf(el); if (k && el.type !== 'checkbox' && el.type !== 'radio') saved[k] = el.value;
    });
    var vals = comp.renderVals();
    var frag = document.createDocumentFragment();
    tpl.content.childNodes.forEach(function (c) { proc(c, vals, frag); });
    app.replaceChildren(frag);
    app.querySelectorAll('input, textarea, select').forEach(function (el) {
      var k = keyOf(el); if (k && k in saved) el.value = saved[k];
    });
    if (focusKey) { var f = document.getElementById(focusKey); if (f) f.focus(); }
    app.setAttribute('data-ready', '');
  }
  document.addEventListener('DOMContentLoaded', function () {
    tpl = document.getElementById('dc-template'); app = document.getElementById('app');
    comp = new window.Component({ accent: '#2E4BE0' });
    render();
  });

  /* Form helpers: submissions are emailed via Web3Forms (key set in /assets/config.js). */
  function post(fields) {
    var data = Object.assign({ access_key: window.DLA_FORM_KEY || '', from_name: 'dlare.co website' }, fields);
    return fetch('https://api.web3forms.com/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { return r.json(); }).then(function (d) { return !!(d && d.success); })
      .catch(function () { return false; });
  }
  function val(form, name) { var el = form && form.querySelector('[name="' + name + '"], #' + name); return el ? el.value.trim() : ''; }
  window.dlaSubscribe = function (form) {
    var input = form && form.querySelector('input[type="email"]'), email = input ? input.value.trim() : '';
    return post({ subject: 'New newsletter subscriber: ' + email, email: email, signed_up_on: location.pathname, botcheck: val(form, 'website') ? true : '' });
  };
  window.dlaContact = function (form, st) {
    var invest = st.mode === 'invest', p = invest ? 'inv-' : 'deal-';
    var d = { name: val(form, p + 'name'), email: val(form, p + 'email'), phone: val(form, p + 'phone'), company: val(form, p + 'company') };
    if (invest) {
      d.subject = 'New investor enquiry: ' + d.name;
      d.investing_from = val(form, 'inv-country'); d.investor_type = st.investorType || ''; d.interests = (st.interests || []).join(', ');
    } else {
      d.subject = 'New deal submission: ' + val(form, 'address');
      d.role = st.role || ''; d.property_address = val(form, 'address'); d.size_sf = val(form, 'size'); d.asset_type = st.assetType || ''; d.asking_price = val(form, 'price'); d.om_link = val(form, 'om');
    }
    d.message = val(form, invest ? 'inv-msg' : 'deal-msg');
    d.replyto = d.email; d.botcheck = val(form, 'website') ? true : '';
    return post(d);
  };
})();
/* Mobile menu */
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-menu-toggle]');
  if (!b) return;
  var nav = b.closest('nav'); var open = nav.classList.toggle('dla-open');
  b.setAttribute('aria-expanded', open ? 'true' : 'false');
  b.textContent = open ? 'Close' : 'Menu';
});
