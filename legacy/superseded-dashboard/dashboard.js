/* ==========================================================================
   Minecraft Tracker — dashboard behaviour
   Vanilla JS, no dependencies. Charts are hand-built SVG (verified rule:
   "Trend Over Time" → Line Chart, SVG under 1000 points; "Heatmap" → grid).
   Every chart is paired with a data-table fallback and a text summary.
   ========================================================================== */
(function () {
  "use strict";

  var DATA = {
    players: [
      { name: "Pixelsmith",   joined: "Mar 14", online: true,  isNew: false, playtime: 214.5, blocks: 48210, deaths: 12 },
      { name: "RedstoneRae",  joined: "Jan 02", online: true,  isNew: false, playtime: 198.2, blocks: 44120, deaths: 8  },
      { name: "CreeperCarl",  joined: "Feb 21", online: false, isNew: false, playtime: 187.9, blocks: 51230, deaths: 21 },
      { name: "MossyMarv",    joined: "Oct 19", online: true,  isNew: true,  playtime: 176.4, blocks: 39880, deaths: 15 },
      { name: "DiamondDee",   joined: "Dec 08", online: false, isNew: false, playtime: 168.0, blocks: 47005, deaths: 9  },
      { name: "NetherNina",   joined: "Apr 30", online: true,  isNew: false, playtime: 154.7, blocks: 36140, deaths: 18 },
      { name: "EnderEli",     joined: "Oct 21", online: false, isNew: true,  playtime: 149.3, blocks: 42990, deaths: 6  },
      { name: "BirchBea",     joined: "May 17", online: true,  isNew: false, playtime: 140.8, blocks: 31020, deaths: 11 },
      { name: "GlowstoneGus", joined: "Jun 05", online: false, isNew: false, playtime: 132.5, blocks: 28470, deaths: 23 },
      { name: "TntTara",      joined: "Oct 22", online: true,  isNew: true,  playtime: 128.1, blocks: 35610, deaths: 31 },
      { name: "BasaltBen",    joined: "Jul 11", online: false, isNew: false, playtime: 119.6, blocks: 26110, deaths: 5  },
      { name: "QuartzQuinn",  joined: "Aug 03", online: false, isNew: false, playtime: 104.2, blocks: 22180, deaths: 14 }
    ],
    trend: {
      start: "2026-10-12",
      playtime: [118, 124, 109, 131, 142, 168, 159, 127, 134, 121, 138, 151, 147, 156],
      players:  [58, 61, 54, 66, 72, 89, 84, 63, 67, 59, 70, 78, 75, 94]
    },
    heat: {
      days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      // 7 rows x 24 hours, average players online
      values: [
        [ 8, 5, 3, 2, 2, 4, 9, 18, 27, 31, 29, 33, 38, 41, 44, 47, 52, 61, 78, 88, 72, 54, 31, 17],
        [ 7, 4, 3, 2, 3, 5, 11, 20, 29, 34, 32, 36, 40, 43, 46, 49, 55, 64, 81, 92, 76, 57, 33, 18],
        [ 9, 6, 4, 3, 3, 6, 12, 22, 31, 36, 35, 38, 42, 45, 48, 52, 58, 67, 84, 95, 79, 60, 35, 19],
        [ 8, 5, 3, 2, 2, 5, 10, 19, 28, 33, 31, 35, 39, 42, 45, 48, 54, 63, 80, 90, 75, 56, 32, 16],
        [10, 7, 5, 4, 4, 7, 14, 25, 35, 41, 40, 44, 49, 53, 57, 62, 69, 79, 98, 110, 94, 72, 44, 24],
        [14, 11, 8, 6, 5, 8, 16, 28, 39, 46, 48, 52, 58, 62, 66, 71, 78, 88, 104, 118, 101, 79, 52, 31],
        [12, 9, 7, 5, 4, 6, 13, 23, 33, 38, 37, 41, 46, 49, 52, 56, 62, 71, 89, 103, 88, 68, 43, 25]
      ]
    }
  };

  var state = { filter: "all", sort: "playtime", dir: "desc", term: "" };

  var nf = new Intl.NumberFormat("en-US");

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function svgIcon(id, cls) {
    return '<svg class="icon ' + (cls || "") + '" aria-hidden="true"><use href="#' + id + '"/></svg>';
  }

  function chartWidth(svgEl, fallback) {
    var host = svgEl.parentElement;
    var w = host ? Math.floor(host.clientWidth) : 0;
    return w > 240 ? w : fallback;
  }

  /* ------------------------------ trend chart ------------------------------ */
  function renderTrend() {
    var svgEl = $("#trend-chart");
    if (!svgEl) return;
    /* viewBox width tracks the rendered width so 1 user unit = 1 CSS px and the
       axis labels keep their real size at every breakpoint (no 5px labels). */
    var W = chartWidth(svgEl, 720), narrow = W < 560;
    var H = narrow ? 300 : 280, L = 46, R = narrow ? 64 : 88, T = 26, B = 36;
    var iw = W - L - R, ih = H - T - B;
    var pt = DATA.trend.playtime, pl = DATA.trend.players, n = pt.length;
    var maxLeft = 180, maxRight = 100;
    var step = iw / (n - 1);
    var x = function (i) { return L + i * step; };
    var yL = function (v) { return T + ih - (v / maxLeft) * ih; };
    var yR = function (v) { return T + ih - (v / maxRight) * ih; };

    var start = new Date(DATA.trend.start + "T00:00:00");
    var dateAt = function (i) { var d = new Date(start.getTime()); d.setDate(d.getDate() + i); return d; };
    var shortDate = function (d) { return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); };

    var g = [];
    // title / desc for screen readers
    g.push('<title id="trend-title">Daily playtime and unique players, last 14 days</title>');
    g.push('<desc id="trend-desc">Two-series line chart. Playtime hours rise from 118 to 156; unique players rise from 58 to 94, peaking on the weekend. Exact values are in the data table and the summary below.</desc>');

    // grid + left axis ticks
    [0, 60, 120, 180].forEach(function (tick) {
      var y = yL(tick);
      g.push('<line class="grid-line" x1="' + L + '" y1="' + y + '" x2="' + (W - R) + '" y2="' + y + '"/>');
      g.push('<text class="axis-label" x="' + (L - 10) + '" y="' + (y + 4) + '" text-anchor="end">' + tick + "</text>");
    });
    // right axis ticks (players) — kept clear of the direct labels
    [0, 50, 100].forEach(function (tick) {
      var y = yR(tick);
      g.push('<text class="axis-label" x="' + (W - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + tick + "</text>");
    });

    // x labels — thinned out on narrow screens so they never collide
    var xStep = narrow ? 4 : 3;
    for (var i = 0; i < n; i += xStep) {
      g.push('<text class="axis-label" x="' + x(i) + '" y="' + (H - 12) + '" text-anchor="middle">' + shortDate(dateAt(i)) + "</text>");
    }

    // area under playtime (20% opacity fill per chart guidance)
    var areaPts = pt.map(function (v, i) { return x(i) + "," + yL(v); }).join(" ");
    g.push('<polygon class="series-area" points="' + L + "," + (T + ih) + " " + areaPts + " " + (W - R) + "," + (T + ih) + '"/>');

    // series
    var lineP = pt.map(function (v, i) { return x(i) + "," + yL(v); }).join(" ");
    var lineL = pl.map(function (v, i) { return x(i) + "," + yR(v); }).join(" ");
    g.push('<polyline class="series-solid" points="' + lineP + '"/>');
    g.push('<polyline class="series-dashed" points="' + lineL + '"/>');

    // last points + direct labels (identity never by colour alone)
    var lastP = pt[n - 1], lastL = pl[n - 1];
    g.push('<circle class="point" cx="' + x(n - 1) + '" cy="' + yL(lastP) + '" r="4"/>');
    g.push('<circle class="point point--alt" cx="' + x(n - 1) + '" cy="' + yR(lastL) + '" r="4"/>');
    var labelX = narrow ? x(n - 1) - 10 : x(n - 1) + 12;
    var anchor = narrow ? ' text-anchor="end"' : "";
    g.push('<text class="direct-label direct-label--playtime" x="' + labelX + '" y="' + (yL(lastP) + 16) + '"' + anchor + '>' + lastP + " h</text>");
    g.push('<text class="direct-label direct-label--players" x="' + labelX + '" y="' + (yR(lastL) - 10) + '"' + anchor + '>' + lastL + "</text>");

    svgEl.setAttribute("viewBox", "0 0 " + W + " " + H);
    svgEl.innerHTML = g.join("");

    var sum = $("#trend-summary");
    if (sum) {
      var firstP = pt[0], peakIdx = pt.indexOf(Math.max.apply(null, pt));
      var pct = Math.round(((lastP - firstP) / firstP) * 1000) / 10;
      sum.textContent = "Playtime grew " + pct + "% across the period (from " + firstP +
        " h to " + lastP + " h), peaking on " + shortDate(dateAt(peakIdx)) + " at " +
        Math.max.apply(null, pt) + " h. Unique players reached " + lastL +
        " on the final day. Values are daily totals in Asia/Singapore.";
    }

    // data table fallback
    var table = $("#trend-table");
    if (table) {
      var rows = ["<thead><tr><th scope=\"col\">Date</th><th scope=\"col\" class=\"num\">Playtime (h)</th><th scope=\"col\" class=\"num\">Unique players</th></tr></thead><tbody>"];
      for (var j = 0; j < n; j++) {
        rows.push("<tr><td>" + shortDate(dateAt(j)) + "</td><td class=\"num\">" + pt[j] +
          "</td><td class=\"num\">" + pl[j] + "</td></tr>");
      }
      rows.push("</tbody>");
      table.innerHTML = rows.join("");
    }
  }

  /* ------------------------------- heatmap -------------------------------- */
  function renderHeat() {
    var svgEl = $("#heatmap");
    if (!svgEl) return;
    var W = chartWidth(svgEl, 420), narrow = W < 560;
    var L = narrow ? 38 : 44, T = 24;
    var cw = (W - L - 6) / 24, gapX = 0.5;
    var ch = narrow ? 24 : 30, gapY = narrow ? 5 : 6;
    var H = T + 7 * (ch + gapY) + 10;
    var values = DATA.heat.values, days = DATA.heat.days;
    var max = 120;

    var g = [];
    g.push('<title id="heat-title">Average players online by day of week and hour</title>');
    g.push('<desc id="heat-desc">Heat map, seven rows for days Monday to Sunday and twenty-four columns for hours. Peak activity is weekday 19:00 to 20:00 and Saturday evening. Exact numbers are in the data table.</desc>');

    // hour labels every 3 hours
    var fmtHour = function (h) { return h === 0 ? "12a" : h < 12 ? h + "a" : h === 12 ? "12p" : (h - 12) + "p"; };
    for (var h = 0; h < 24; h += 3) {
      g.push('<text class="axis-label" x="' + (L + h * (cw + gapX)) + '" y="' + (T - 8) + '">' + fmtHour(h) + "</text>");
    }
    // day labels
    days.forEach(function (day, d) {
      var y = T + d * (ch + gapY);
      g.push('<text class="heat-row-label" x="' + (L - 10) + '" y="' + (y + ch / 2 + 4) + '" text-anchor="end">' + day + "</text>");
      for (var hr = 0; hr < 24; hr++) {
        var v = values[d][hr];
        var op = 0.06 + (v / max) * 0.94;
        g.push('<rect class="heat-cell" x="' + (L + hr * (cw + gapX)) + '" y="' + y +
          '" width="' + cw + '" height="' + ch + '" fill-opacity="' + op.toFixed(2) +
          '"><title>' + day + " " + fmtHour(hr) + ": " + v + " players average</title></rect>");
      }
    });

    svgEl.setAttribute("viewBox", "0 0 " + W + " " + H);
    svgEl.innerHTML = g.join("");

    // data table fallback: rows = hour, columns = days
    var table = $("#heat-table");
    if (table) {
      var out = ['<thead><tr><th scope="col">Hour</th>'];
      days.forEach(function (d) { out.push('<th scope="col" class="num">' + d + "</th>"); });
      out.push("</tr></thead><tbody>");
      for (var hr2 = 0; hr2 < 24; hr2++) {
        out.push('<tr><th scope="row">' + fmtHour(hr2) + "</th>");
        for (var d2 = 0; d2 < 7; d2++) out.push('<td class="num">' + values[d2][hr2] + "</td>");
        out.push("</tr>");
      }
      out.push("</tbody>");
      table.innerHTML = out.join("");
    }
  }

  /* ------------------------------ player table ---------------------------- */
  function currentRows() {
    var rows = DATA.players.map(function (p, i) {
      return { player: p, rank: i + 1 };
    });
    if (state.filter === "online") rows = rows.filter(function (r) { return r.player.online; });
    if (state.filter === "offline") rows = rows.filter(function (r) { return !r.player.online; });
    if (state.filter === "new") rows = rows.filter(function (r) { return r.player.isNew; });
    if (state.term) {
      var t = state.term.toLowerCase();
      rows = rows.filter(function (r) { return r.player.name.toLowerCase().indexOf(t) !== -1; });
    }
    var key = state.sort, dir = state.dir === "asc" ? 1 : -1;
    rows.sort(function (a, b) {
      var av = a.player[key], bv = b.player[key];
      if (typeof av === "string") return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
    return rows;
  }

  function renderPlayers() {
    var body = $("#players-body");
    var empty = $("#players-empty");
    var wrap = $("#players-wrap");
    if (!body) return;
    var rows = currentRows();

    body.innerHTML = rows.map(function (r) {
      var p = r.player;
      var initials = p.name.slice(0, 2).toUpperCase();
      var status = p.online
        ? '<span class="status status--online"><span class="status__glyph" aria-hidden="true"></span>Online</span>'
        : '<span class="status status--offline"><span class="status__glyph" aria-hidden="true"></span>Offline</span>';
      var badge = p.isNew ? '<span class="badge-new">New</span>' : "";
      return "<tr>" +
        '<td class="col-rank">' + r.rank + "</td>" +
        '<td><span class="player"><span class="avatar" aria-hidden="true">' + initials + "</span>" +
          '<span><span class="player__name">' + p.name + badge + "</span>" +
          '<span class="player__meta">Joined ' + p.joined + "</span></span></span></td>" +
        "<td>" + status + "</td>" +
        '<td class="num">' + p.playtime.toFixed(1) + " h</td>" +
        '<td class="num">' + nf.format(p.blocks) + "</td>" +
        '<td class="num"><span class="deaths">' + svgIcon("i-skull") + p.deaths + "</span></td>" +
        "<td>" + (p.online ? "Just now" : "—") + "</td>" +
        "</tr>";
    }).join("");

    var hasRows = rows.length > 0;
    if (empty) empty.hidden = hasRows;
    if (wrap) wrap.hidden = !hasRows;
    if (!hasRows) {
      var term = $("#empty-term");
      if (term) term.textContent = state.term || state.filter;
    }

    var visible = $("#visible-count");
    if (visible) visible.textContent = String(rows.length);
    var total = $("#total-count");
    if (total) total.textContent = String(DATA.players.length);

    var live = $("#table-live");
    if (live) {
      var label = state.filter === "all" ? "all players" : state.filter === "new" ? "new players" : state.filter + " players";
      live.textContent = hasRows
        ? "Showing " + rows.length + " of " + DATA.players.length + " " + label + "."
        : "No players match the current filter.";
    }
  }

  function syncSortIndicators() {
    $$("#players-table th[aria-sort]").forEach(function (th) {
      var btn = th.querySelector(".sort");
      if (!btn) return;
      var key = btn.getAttribute("data-sort");
      if (key === state.sort) {
        th.setAttribute("aria-sort", state.dir === "asc" ? "ascending" : "descending");
        btn.querySelector("use").setAttribute("href", state.dir === "asc" ? "#i-chevron-up" : "#i-chevron-down");
      } else {
        th.setAttribute("aria-sort", "none");
        btn.querySelector("use").setAttribute("href", "#i-sort");
      }
    });
  }

  /* -------------------------------- events -------------------------------- */
  function wire() {
    $$(".chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        state.filter = chip.getAttribute("data-filter");
        $$(".chip").forEach(function (c) {
          c.setAttribute("aria-pressed", String(c === chip));
        });
        renderPlayers();
      });
    });

    $$("#players-table .sort").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-sort");
        if (state.sort === key) {
          state.dir = state.dir === "asc" ? "desc" : "asc";
        } else {
          state.sort = key;
          state.dir = key === "name" ? "asc" : "desc";
        }
        syncSortIndicators();
        renderPlayers();
      });
    });

    var search = $("#player-search");
    if (search) {
      search.addEventListener("input", function () {
        state.term = search.value.trim();
        renderPlayers();
      });
    }

    var clear = $("#clear-search");
    if (clear) {
      clear.addEventListener("click", function () {
        state.term = "";
        if (search) { search.value = ""; search.focus(); }
        renderPlayers();
      });
    }

    var refresh = $("#refresh");
    if (refresh) {
      refresh.addEventListener("click", function () {
        if (refresh.disabled) return;
        refresh.disabled = true;
        var body = $("#players-body");
        var rows = "";
        for (var i = 0; i < 6; i++) {
          rows += '<tr><td colspan="7"><div class="skeleton-row">' +
            '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>' +
            '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>' +
            "</div></td></tr>";
        }
        if (body) body.innerHTML = rows;
        var empty = $("#players-empty");
        if (empty) empty.hidden = true;
        var wrap = $("#players-wrap");
        if (wrap) wrap.hidden = false;

        window.setTimeout(function () {
          renderPlayers();
          var now = new Date();
          var synced = $("#synced-at");
          if (synced) {
            synced.textContent = "today at " + now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
            synced.setAttribute("datetime", now.toISOString());
          }
          var live = $("#table-live");
          if (live) live.textContent = "Data refreshed.";
          refresh.disabled = false;
        }, 700);
      });
    }

    var server = $("#server");
    if (server) {
      server.addEventListener("change", function () {
        var live = $("#table-live");
        if (live) live.textContent = "Viewing " + server.value + ". Demonstration data is unchanged.";
      });
    }

    /* ---- failure path: offline / sync error (AC-6) ---- */
    var alertBox = $("#offline-alert");
    function setOffline(offline) {
      if (!alertBox) return;
      alertBox.hidden = !offline;
      var live = $("#table-live");
      if (live) {
        live.textContent = offline
          ? "Connection lost. You are seeing the last synced data."
          : "Back online. Data can be refreshed.";
      }
    }
    window.addEventListener("offline", function () { setOffline(true); });
    window.addEventListener("online", function () { setOffline(false); });
    if (!navigator.onLine) setOffline(true);

    var retry = $("#retry");
    if (retry) {
      retry.addEventListener("click", function () {
        if (!navigator.onLine) {
          var live = $("#table-live");
          if (live) live.textContent = "Still offline. Retry when the connection returns.";
          return;
        }
        setOffline(false);
        var refreshBtn = $("#refresh");
        if (refreshBtn) refreshBtn.click();
      });
    }
  }

  function init() {
    renderTrend();
    renderHeat();
    syncSortIndicators();
    renderPlayers();
    wire();

    // charts are sized to the rendered width, so they must be rebuilt on resize
    var resizeTimer = null;
    window.addEventListener("resize", function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        renderTrend();
        renderHeat();
      }, 180);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
