function ysCoDebug(msg, err) {
  if (!err) {
    if (window.console) console.log('[ysCheckout]', msg);
    return;
  }
  var el = document.getElementById('ysCoDebugBar');
  if (!el) return;
  el.style.background = '#fee2e2';
  el.style.color = '#991b1b';
  el.style.borderColor = '#dc2626';
  el.style.display = 'block';
  el.textContent = 'YISUS DEBUG > ' + msg;
}

function ysCoInit() {
  try {
    document.body.classList.add('yisus-checkout');

    var API = "https://yisus-store-checkout.vercel.app/api/create-transaction";
    var KEY = "yisus_checkout";
    var FREE = 150000;
    var FLAT = 13000;
    var MIN_ORDER = 120000;

    function computeShipping(sub) {
      return sub >= FREE ? 0 : FLAT;
    }

    var raw = localStorage.getItem(KEY);
    var preview = raw ? raw.slice(0, 200) : '(empty)';
    ysCoDebug('raw len=' + (raw ? raw.length : 0) + ' | ' + preview);

    var data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch (e) {
      ysCoDebug('JSON parse FAIL: ' + e.message, true);
    }

    var hasItems = data && data.items && data.items.length;
    var hasTitle = data && data.title;

    if (!data || (!hasItems && !hasTitle)) {
      ysCoDebug('EMPTY: ' + JSON.stringify(data));
      var emp = '';
      emp += '<div class="ys-co-empty">';
      emp += '<h2>Tu carrito esta vacio</h2>';
      emp += '<p>Agrega productos antes de continuar al pago.</p>';
      emp += '<a href="/shop">Ir a la tienda</a>';
      emp += '</div>';
      document.getElementById('ysCoContent').innerHTML = emp;
      document.getElementById('ysCoRight').style.display = 'none';
      return;
    }

    var items;
    if (hasItems) {
      items = data.items;
    } else {
      items = [{
        title: data.title,
        unit_price: data.price,
        quantity: data.quantity || 1,
        image: data.image
      }];
    }

    ysCoDebug(
      'items=' + items.length +
      ' | price=' + (items[0] && items[0].unit_price) +
      ' | title=' + (items[0] && items[0].title)
    );

    function fmt(n) {
      var v = n || 0;
      var opts = { maximumFractionDigits: 0 };
      return 'COP ' + new Intl.NumberFormat('es-CO', opts).format(v);
    }

    function esc(s) {
      var t = String(s == null ? '' : s);
      t = t.replace(/&/g, '&amp;');
      t = t.replace(/</g, '&lt;');
      t = t.replace(/>/g, '&gt;');
      t = t.replace(/"/g, '&quot;');
      t = t.replace(/'/g, '&#39;');
      return t;
    }

    function renderThumb(item, qty) {
      if (item.image) {
        var img = esc(item.image);
        var h = '';
        h += '<div class="ys-co-thumb" style="background-image:url(\'';
        h += img;
        h += '\');">';
        h += '<div class="ys-co-thumb-badge">' + qty + '</div>';
        h += '</div>';
        return h;
      }
      var initial = (item.title || '?').charAt(0).toUpperCase();
      var h2 = '';
      h2 += '<div class="ys-co-thumb ys-co-thumb-fallback">';
      h2 += esc(initial);
      h2 += '<div class="ys-co-thumb-badge">' + qty + '</div>';
      h2 += '</div>';
      return h2;
    }

    function renderRow(item) {
      var qty = Number(item.quantity) || 1;
      var unit = Number(item.unit_price) || 0;
      var line = unit * qty;
      var h = '';
      h += '<div class="ys-co-summary-item">';
      h += renderThumb(item, qty);
      h += '<div class="ys-co-item-meta">';
      h += '<div class="ys-co-item-title">' + esc(item.title) + '</div>';
      h += '</div>';
      h += '<div class="ys-co-item-price">' + fmt(line) + '</div>';
      h += '</div>';
      return { html: h, line: line };
    }

    function render() {
      var container = document.getElementById('ysCoItems');
      var subtotal = 0;
      var html = '';

      items.forEach(function (item) {
        var row = renderRow(item);
        subtotal += row.line;
        html += row.html;
      });

      container.innerHTML = html;

      var ship = computeShipping(subtotal);
      var total = subtotal + ship;

      document.getElementById('ysCoSubtotal').textContent = fmt(subtotal);
      document.getElementById('ysCoTotal').textContent = fmt(total);
      document.getElementById('ysCoMobileTotal').textContent = fmt(total);

      var shipS = document.getElementById('ysCoShipSummary');
      if (ship === 0) {
        shipS.innerHTML = '<span class="ys-co-free">GRATIS</span>';
      } else {
        var s = '<span style="color:#fff;font-weight:700;">';
        s += fmt(ship);
        s += '</span>';
        shipS.innerHTML = s;
      }

      var shipL = document.getElementById('ysCoShipLabel');
      if (ship === 0) {
        shipL.innerHTML = '<span class="free">GRATIS</span>';
      } else {
        shipL.innerHTML = '<span class="cost">' + fmt(ship) + '</span>';
      }

      var nudge = document.getElementById('ysCoNudge');
      var submitBtn = document.getElementById('ysCoSubmit');
      if (subtotal < MIN_ORDER) {
        var faltaMin = MIN_ORDER - subtotal;
        var pctMin = (subtotal / MIN_ORDER) * 100;
        if (pctMin < 0) pctMin = 0;
        if (pctMin > 100) pctMin = 100;
        nudge.className = 'ys-co-free-nudge below-min';
        nudge.style.display = 'block';
        var nM = '';
        nM += 'Pedido minimo <b>' + fmt(MIN_ORDER) + '</b>. ';
        nM += 'Te faltan <b>' + fmt(faltaMin) + '</b>';
        nM += '<div class="ys-co-free-nudge-progress">';
        nM += '<div class="ys-co-free-nudge-bar" style="width:';
        nM += pctMin;
        nM += '%"></div>';
        nM += '</div>';
        nudge.innerHTML = nM;
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Pedido minimo ' + fmt(MIN_ORDER);
        }
      } else if (ship === 0) {
        nudge.className = 'ys-co-free-nudge achieved';
        nudge.style.display = 'block';
        var n1 = '';
        n1 += '<span>Envio gratis desbloqueado</span>';
        n1 += '<div class="ys-co-free-nudge-progress">';
        n1 += '<div class="ys-co-free-nudge-bar" style="width:100%"></div>';
        n1 += '</div>';
        nudge.innerHTML = n1;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Pagar con Wompi';
        }
      } else {
        var falta = FREE - subtotal;
        var pct = (subtotal / FREE) * 100;
        if (pct < 0) pct = 0;
        if (pct > 100) pct = 100;
        nudge.className = 'ys-co-free-nudge';
        nudge.style.display = 'block';
        var n2 = '';
        n2 += 'Te faltan <b>' + fmt(falta) + '</b> para envio gratis';
        n2 += '<div class="ys-co-free-nudge-progress">';
        n2 += '<div class="ys-co-free-nudge-bar" style="width:';
        n2 += pct;
        n2 += '%"></div>';
        n2 += '</div>';
        nudge.innerHTML = n2;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Pagar con Wompi';
        }
      }

      ysCoDebug(
        'RENDER OK | subtotal=' + subtotal +
        ' | ship=' + ship +
        ' | total=' + total
      );
    }

    render();

    // ─── DIVIPOLA: dept + city selectors backed by DANE dataset ────
    var DIVIPOLA_URL =
      'https://yisus-store-checkout.vercel.app/api/divipola';
    var YS_GEO = null;

    function ysGeoNorm(s) {
      var t = String(s == null ? '' : s).trim().toLowerCase();
      t = t.normalize('NFD').replace(/[̀-ͯ]/g, '');
      return t;
    }

    function ysFindDept(key) {
      if (!YS_GEO) return null;
      var n = ysGeoNorm(key);
      var keys = Object.keys(YS_GEO);
      for (var i = 0; i < keys.length; i++) {
        if (ysGeoNorm(keys[i]) === n) return keys[i];
      }
      return null;
    }

    function ysFindCity(dept, key) {
      if (!YS_GEO || !YS_GEO[dept]) return null;
      var n = ysGeoNorm(key);
      var arr = YS_GEO[dept];
      for (var i = 0; i < arr.length; i++) {
        if (ysGeoNorm(arr[i]) === n) return arr[i];
      }
      return null;
    }

    function ysBuildOpts(values) {
      var out = '';
      for (var i = 0; i < values.length; i++) {
        var v = String(values[i])
          .replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;');
        out += '<option value="' + v + '"></option>';
      }
      return out;
    }

    function ysPopulateDepts() {
      var dl = document.getElementById('ys-depts-list');
      if (!dl || !YS_GEO) return;
      var keys = Object.keys(YS_GEO).sort(function (a, b) {
        return a.localeCompare(b, 'es');
      });
      dl.innerHTML = ysBuildOpts(keys);
    }

    function ysPopulateCities(dept) {
      var dl = document.getElementById('ys-cities-list');
      if (!dl) return;
      var arr = (YS_GEO && YS_GEO[dept]) || [];
      dl.innerHTML = ysBuildOpts(arr);
    }

    var deptInp = document.getElementById('ys-dept');
    var cityInp = document.getElementById('ys-city');

    if (deptInp && cityInp) {
      deptInp.addEventListener('input', function () {
        var canonical = ysFindDept(deptInp.value);
        cityInp.value = '';
        ysPopulateCities(canonical || '__none__');
      });
    }

    fetch(DIVIPOLA_URL)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        YS_GEO = d;
        ysPopulateDepts();
        if (deptInp && deptInp.value) {
          var c = ysFindDept(deptInp.value);
          if (c) ysPopulateCities(c);
        }
      })
      .catch(function () {
        // Silent fail: user can still type manually.
        // Server-side validation catches invalid combinations.
      });

    var toggle = document.getElementById('ysCoToggle');
    var right = document.getElementById('ysCoRight');
    var toggleText = document.getElementById('ysCoToggleText');

    toggle.addEventListener('click', function () {
      right.classList.toggle('open');
      toggle.classList.toggle('open');
      var open = right.classList.contains('open');
      toggleText.textContent = open ? 'Ocultar resumen' : 'Ver resumen del pedido';
    });

    var form = document.getElementById('ysCoForm');
    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      var submitBtn = document.getElementById('ysCoSubmit');
      var errBox = document.getElementById('ysCoError');
      errBox.style.display = 'none';

      var fd = new FormData(this);
      var first = (fd.get('firstName') || '').trim();
      var last = (fd.get('lastName') || '').trim();
      var fullName = (first + ' ' + last).trim();
      var phone = (fd.get('phone') || '').replace(/\D/g, '');

      if (!/^\d{10}$/.test(phone)) {
        errBox.textContent = 'El celular debe tener 10 digitos (ej: 3108962777).';
        errBox.style.display = 'block';
        return;
      }

      var currentSub = items.reduce(function (s, it) {
        var q = Number(it.quantity) || 1;
        var u = Number(it.unit_price) || 0;
        return s + q * u;
      }, 0);
      if (currentSub < MIN_ORDER) {
        errBox.textContent =
          'Pedido minimo COP ' + MIN_ORDER.toLocaleString('es-CO') + '.';
        errBox.style.display = 'block';
        return;
      }

      if (YS_GEO) {
        var rawDept = (fd.get('department') || '').trim();
        var rawCity = (fd.get('city') || '').trim();
        var dK = ysFindDept(rawDept);
        if (!dK) {
          errBox.textContent =
            'Selecciona un departamento valido de la lista.';
          errBox.style.display = 'block';
          if (deptInp) deptInp.focus();
          return;
        }
        var cK = ysFindCity(dK, rawCity);
        if (!cK) {
          errBox.textContent =
            'La ciudad debe ser un municipio de ' + dK + '.';
          errBox.style.display = 'block';
          if (cityInp) cityInp.focus();
          return;
        }
        fd.set('department', dK);
        fd.set('city', cK);
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Redirigiendo a Wompi...';

      var shipping = {
        fullName: fullName,
        email: fd.get('email'),
        phone: phone,
        department: fd.get('department'),
        city: fd.get('city'),
        address: fd.get('address'),
        neighborhood: fd.get('neighborhood'),
        extraAddress: fd.get('extraAddress') || '',
        notes: fd.get('notes') || ''
      };

      var payload;
      if (items.length > 1) {
        payload = {
          items: items,
          shipping: shipping,
          shipping_cost: 0,
          discount_amount: 0
        };
      } else {
        payload = {
          title: items[0].title,
          price: items[0].unit_price,
          quantity: items[0].quantity,
          shipping: shipping,
          shipping_cost: 0,
          discount_amount: 0
        };
      }

      try {
        var res = await fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        var body = await res.json();

        if (body.checkout_url) {
          localStorage.removeItem(KEY);
          window.location.href = body.checkout_url;
        } else {
          var msg = body.error || 'No fue posible iniciar el pago.';
          errBox.textContent = msg;
          errBox.style.display = 'block';
          submitBtn.disabled = false;
          submitBtn.textContent = 'Pagar con Wompi';
        }
      } catch (err) {
        errBox.textContent = 'Error de conexion. Verifica tu internet.';
        errBox.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Pagar con Wompi';
      }
    });

  } catch (fatal) {
    var m = fatal && fatal.message ? fatal.message : String(fatal);
    ysCoDebug('FATAL: ' + m, true);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ysCoInit);
} else {
  ysCoInit();
}
