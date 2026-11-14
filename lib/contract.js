// Hợp đồng thuê phòng trọ: dựng nội dung từ dữ liệu phần mềm, xuất ra HTML (in / lưu PDF) và Word (.docx).
import { moneyWords } from './vnwords.js';
import { priceAt } from './billing.js';
import { zip } from './xlsx.js';

const dmy = (s) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split('-').reverse().join('/') : '');
const n = (x) => (Number(x) || 0).toLocaleString('vi-VN');
const DOTS = '……………………';
const CYCLE = { month: { name: 'tháng', times: 1, label: 'Theo tháng' }, quarter: { name: 'quý', times: 3, label: 'Theo quý' }, year: { name: 'năm', times: 12, label: 'Theo năm' } };
const v = (x, dots = DOTS) => (x !== undefined && x !== null && String(x).trim() !== '' ? { b: String(x).trim() } : dots);

export function contractData(db, rental, opts = {}) {
  const tenant = db.tenants.find((t) => t.id === rental.tenantId) || {}; const room = db.rooms.find((r) => r.id === rental.roomId) || {};
  const L = db.meta?.landlord || {}; const price = priceAt(db, rental.id, opts.today || rental.startDate) || {};
  const occ = db.occupants.filter((o) => o.tenantId === rental.tenantId);
  return { signDate: opts.signDate || opts.today || '', L, tenant, room, rental, price, occ };
}

export function buildContract(d) {
  const { L, tenant: T, room, rental: R, price, occ } = d; const cyc = CYCLE[R.payCycle] || CYCLE.month; const rent = Number(price.rent) || 0; const dep = Number(R.deposit) || 0;
  const sd = d.signDate ? d.signDate.split('-') : null; const house = L.houseAddress || '';
  const B = [];
  const c = (text, o = {}) => B.push({ t: 'c', text, ...o });
  const h = (text) => B.push({ t: 'h', text });
  const p = (...runs) => B.push({ t: 'p', runs });
  const li = (level, ...runs) => B.push({ t: 'li', level, runs });
  c('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { bold: true }); c('Độc lập – Tự do – Hạnh phúc', { bold: true }); B.push({ t: 'hr' });
  c('HỢP ĐỒNG THUÊ PHÒNG TRỌ', { bold: true, big: true }); c(['Số: ', v(R.contractNo, '……'), '/HĐTPT']);
  p('Hôm nay, ngày ', v(sd && Number(sd[2]), '……'), ' tháng ', v(sd && Number(sd[1]), '……'), ' năm ', v(sd && sd[0], '………'), ', tại địa chỉ: ', v(house, '....................................................'), ', chúng tôi gồm:');
  const person = (x, withHometown = []) => [
    li(1, '- Ông/Bà: ', v(x.fullName)), li(1, '- Ngày sinh: ', v(dmy(x.dob))),
    li(1, '- Số CCCD: ', v(x.cccd), '\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0Ngày cấp: ', v(dmy(x.cccdIssueDate))), li(1, '- Nơi cấp: ', v(x.cccdIssuePlace)),
    li(1, '- Địa chỉ thường trú: ', v(x.address)), ...(withHometown.length ? [li(1, '- Quê quán: ', v(x.hometown))] : []), li(1, '- Số điện thoại: ', v(x.phone))];
  h('ĐIỀU 1. THÔNG TIN BÊN CHO THUÊ (BÊN A)'); person(L);
  h('ĐIỀU 2. THÔNG TIN NGƯỜI THUÊ CHÍNH (BÊN B)'); person(T, [true]);
  h('ĐIỀU 3. THÔNG TIN NHỮNG NGƯỜI CÙNG Ở');
  p('Bên B đăng ký đầy đủ thông tin những người cùng sinh sống tại phòng trọ như sau:');
  const stay = (o) => (o.stayMode === 'range' && o.stayFrom && o.stayTo ? `Từ ngày ${dmy(o.stayFrom)} đến ngày ${dmy(o.stayTo)}` : `Kể từ ngày ${dmy(o.stayFrom || R.startDate)}`);
  B.push({ t: 'table', head: ['STT', 'Họ và tên', 'Ngày sinh', 'Số CCCD', 'Địa chỉ thường trú', 'Số điện thoại', 'Thời gian ở'], widths: [640, 1420, 1200, 1500, 1661, 1250, 1400],
    rows: occ.length ? occ.map((o, i) => [String(i + 1), o.fullName, dmy(o.dob), o.noId ? 'Chưa có (trẻ em)' : o.cccd || '', o.address || '', o.phone || '', stay(o)]) : [['—', 'Không có người ở cùng', '', '', '', '', '']] });
  li(0, '- Tổng số người đăng ký ở: ', v(1 + occ.length, '..........'), ' người.');
  [ '- Bên B cam kết toàn bộ thông tin cung cấp trong hợp đồng là chính xác, đầy đủ và chịu trách nhiệm về tính chính xác của các thông tin này.',
    '- Những người cùng ở có trách nhiệm chấp hành đầy đủ nội quy nhà trọ và các quy định của pháp luật.',
    '- Khi có người chuyển đến, chuyển đi hoặc thay đổi thông tin cá nhân, Bên B phải thông báo cho Bên A để cập nhật thông tin và phối hợp thực hiện thủ tục cư trú theo quy định.' ].forEach((t) => li(0, t));
  li(0, '- Số người ở tối đa không quá ', { b: '03 người lớn' }, ', trừ trường hợp được Bên A đồng ý.');
  li(0, '- Bên B chịu trách nhiệm về các nghĩa vụ phát sinh từ việc sử dụng phòng và việc quản lý những người cùng ở theo hợp đồng này.');
  h('ĐIỀU 4. NỘI DUNG THUÊ PHÒNG VÀ GIÁ THUÊ');
  li(0, '1. Bên A đồng ý cho Bên B thuê phòng số: ', v(room.name, '....................'), ' tại địa chỉ: ', v(house, '....................................................'));
  li(0, '2. Mục đích thuê: Để ở, không sử dụng vào mục đích kinh doanh hoặc hoạt động trái pháp luật.');
  li(0, '3. Thời hạn thuê: ', v((R.termFrom || R.startDate) ? (R.termMode === 'range' && R.termTo ? `Từ ngày ${dmy(R.termFrom || R.startDate)} đến ngày ${dmy(R.termTo)}` : `Kể từ ngày ${dmy(R.termFrom || R.startDate)}`) : '', '.......'));
  li(0, '4. Giá thuê phòng: ', v(rent ? n(rent) : '', '........................................'), ' đồng/tháng.');
  li(1, 'Bằng chữ: ', v(rent ? moneyWords(rent) : '', '....................................................'));
  li(0, '5. Hình thức thanh toán tiền thuê:');
  for (const k of ['month', 'quarter', 'year']) { const x = CYCLE[k]; li(1, '- ', x.label, ': ', (R.payCycle || 'month') === k ? '☒ ' : '☐ ', rent ? { b: `${n(rent * x.times)} đồng/${x.name}` } : '.............................................'); }
  li(1, 'Kỳ thanh toán được hai bên thống nhất là theo: ', { b: `${cyc.name} / lần` });
  li(0, '6. Thời điểm thanh toán: Bên B có trách nhiệm thanh toán tiền thuê vào ngày đầu tiên của kỳ thanh toán tiếp theo, theo hình thức đã thỏa thuận.');
  li(0, '7. Giá thuê phòng chưa bao gồm tiền điện, nước và các khoản dịch vụ khác (nếu có).');
  li(0, '8. Các khoản chi phí sử dụng:');
  li(1, '- Điện: ', v(price.elecPrice !== undefined ? n(price.elecPrice) : '', '....................'), ' đồng/kWh.');
  li(1, '- Nước: ', v(price.waterPrice !== undefined ? n(price.waterPrice) : '', '....................'), ' đồng/m³.');
  li(1, '- Phí dịch vụ khác (nếu có): ', v(R.serviceFee, '........................................'));
  li(0, '9. Tiền điện, nước và các khoản phí phát sinh được thanh toán cùng kỳ tiền thuê phòng hoặc theo thông báo của Bên A.');
  li(0, '10. Việc thay đổi giá thuê hoặc các khoản phí phải được hai bên thống nhất trước.');
  h('ĐIỀU 5. TIỀN ĐẶT CỌC VÀ THANH TOÁN');
  li(0, '1. Bên B đặt cọc cho Bên A số tiền: ', { b: `${n(dep)}` }, ' đồng.');
  li(1, 'Bằng chữ: ', { b: moneyWords(dep) });
  [ '2. Tiền đặt cọc nhằm bảo đảm việc thực hiện hợp đồng và các nghĩa vụ thanh toán, bảo quản, bàn giao phòng của Bên B.',
    '3. Bên B có trách nhiệm thanh toán tiền thuê phòng, điện, nước và các khoản phí phát sinh đầy đủ, đúng thời hạn đã thỏa thuận.',
    '4. Bên A được khấu trừ tiền đặt cọc để thanh toán các khoản:' ].forEach((t) => li(0, t));
  [ '- Tiền thuê phòng còn nợ.', '- Tiền điện, nước và các khoản phí dịch vụ còn nợ.', '- Chi phí sửa chữa, thay thế tài sản, thiết bị bị hư hỏng hoặc mất mát do lỗi của Bên B hoặc người cùng ở.', '- Các nghĩa vụ tài chính khác phát sinh từ việc vi phạm hợp đồng của Bên B.' ].forEach((t) => li(1, t));
  [ '5. Việc khấu trừ tiền đặt cọc phải có căn cứ và được thông báo rõ ràng cho Bên B.',
    '6. Khi hợp đồng chấm dứt, Bên B có trách nhiệm thanh toán đầy đủ các khoản công nợ, bàn giao lại phòng và tài sản. Bên A hoàn trả phần tiền đặt cọc còn lại sau khi đã đối chiếu và khấu trừ các nghĩa vụ hợp lệ của Bên B.',
    '7. Trường hợp tiền đặt cọc không đủ bù đắp các khoản công nợ hoặc thiệt hại thực tế do lỗi của Bên B, Bên B có trách nhiệm thanh toán phần còn thiếu.' ].forEach((t) => li(0, t));
  h('ĐIỀU 6. TRÁCH NHIỆM CỦA BÊN A');
  [ '1. Bảo đảm quyền cho thuê hợp pháp đối với phòng trọ và không có tranh chấp làm ảnh hưởng đến quyền sử dụng phòng của Bên B.',
    '2. Bàn giao phòng và các trang thiết bị kèm theo đúng tình trạng đã thỏa thuận.',
    '3. Bảo đảm hệ thống điện, nước và các thiết bị thuộc trách nhiệm của Bên A hoạt động bình thường tại thời điểm bàn giao.',
    '4. Phối hợp thực hiện các thủ tục khai báo, đăng ký cư trú theo quy định pháp luật.',
    '5. Có quyền yêu cầu Bên B thanh toán tiền thuê, điện, nước và các khoản phí đúng hạn; sử dụng phòng đúng mục đích và tuân thủ nội quy nhà trọ.',
    '7. Có quyền kiểm tra tình trạng phòng khi cần thiết nhưng phải thông báo trước và phối hợp với Bên B, trừ trường hợp khẩn cấp cần xử lý ngay để bảo đảm an toàn.',
    '8. Có quyền yêu cầu Bên B cung cấp, cập nhật thông tin người ở cùng khi cần thiết để phục vụ công tác quản lý và thực hiện các thủ tục cư trú theo quy định.' ].forEach((t) => li(0, t));
  h('ĐIỀU 7. TRÁCH NHIỆM CỦA BÊN B VÀ NHỮNG NGƯỜI CÙNG Ở');
  [ '1. Thanh toán tiền thuê phòng, tiền điện, nước và các khoản phí đầy đủ, đúng thời hạn đã thỏa thuận.',
    '2. Sử dụng phòng đúng mục đích để ở; không tự ý tăng số người ở hoặc cho người khác thuê lại, chuyển nhượng quyền thuê khi chưa được Bên A đồng ý.',
    '3. Cung cấp đầy đủ, chính xác giấy tờ tùy thân và thông tin của tất cả người cùng ở để phục vụ việc khai báo, đăng ký cư trú theo quy định.',
    '4. Giữ gìn vệ sinh chung, bảo vệ tài sản, trang thiết bị và kết cấu phòng trọ. Bên B chịu trách nhiệm đối với thiệt hại do mình hoặc người cùng ở gây ra.',
    '5. Bên B có trách nhiệm tự thay thế, sửa chữa các vật dụng tiêu hao hoặc hư hỏng phát sinh trong quá trình sử dụng phòng như bóng đèn, vòi nước và các vật dụng tương tự, trừ trường hợp hư hỏng do lỗi kỹ thuật, chất lượng ban đầu hoặc thuộc trách nhiệm sửa chữa của Bên A.',
    '6. Không tự ý sửa chữa, cải tạo, đục phá, khoan tường, thay đổi kết cấu hoặc lắp đặt thiết bị ảnh hưởng đến tường, cột, nền, trần và hệ thống kỹ thuật khi chưa được Bên A đồng ý.',
    '7. Không chứa chấp, tàng trữ, sử dụng chất cấm, hàng cấm, chất dễ cháy nổ hoặc vật dụng nguy hiểm trái quy định pháp luật.',
    '8. Nghiêm cấm các hành vi:' ].forEach((t) => li(0, t));
  [ '- Cờ bạc, sử dụng ma túy, đánh nhau, gây rối trật tự hoặc vi phạm pháp luật.', '- Tụ tập ăn nhậu gây ồn ào, ảnh hưởng đến những người xung quanh.', '- Nuôi chó, mèo hoặc thú cưng trong khu nhà trọ khi chưa được Bên A cho phép.', '- Tự ý cho người khác ở thường xuyên khi chưa được Bên A đồng ý.', '- Tự ý đấu nối, sửa chữa hệ thống điện, nước.' ].forEach((t) => li(1, t));
  [ '9. Chấp hành nội quy chung của khu nhà trọ, quy định về an ninh trật tự, phòng cháy chữa cháy và vệ sinh môi trường.',
    '10. Có trách nhiệm khóa cửa, tắt các thiết bị điện khi ra khỏi phòng; thông báo kịp thời cho Bên A khi phát hiện sự cố điện, nước, cháy nổ hoặc các vấn đề có nguy cơ ảnh hưởng đến an toàn.',
    '11. Bên B có trách nhiệm phổ biến nội quy và bảo đảm những người cùng ở thực hiện đầy đủ các cam kết trong hợp đồng.' ].forEach((t) => li(0, t));
  h('ĐIỀU 8. VI PHẠM NGHĨA VỤ THANH TOÁN VÀ XỬ LÝ CÔNG NỢ');
  [ '1. Bên B có nghĩa vụ thanh toán tiền thuê phòng theo kỳ đã lựa chọn và thỏa thuận tại Điều 4 của hợp đồng.',
    '2. Trường hợp Bên B không thanh toán tiền thuê phòng vào đầu kỳ thanh toán theo thỏa thuận (tháng, quý hoặc năm), Bên A có quyền thông báo yêu cầu Bên B thanh toán và thực hiện quyền chấm dứt hợp đồng theo thỏa thuận và quy định pháp luật.',
    '3. Trường hợp Bên B không thanh toán tiền điện, nước hoặc các khoản phí phát sinh, Bên A có quyền thông báo, yêu cầu Bên B thanh toán đầy đủ và thực hiện các biện pháp yêu cầu thanh toán theo quy định pháp luật.',
    '4. Trường hợp Bên B cố tình không thanh toán hoặc không thực hiện nghĩa vụ tài chính sau khi đã được thông báo, Bên A có quyền:' ].forEach((t) => li(0, t));
  [ '- Yêu cầu Bên B thanh toán toàn bộ tiền thuê phòng, tiền điện, nước và các khoản công nợ còn thiếu.', '- Khấu trừ các khoản công nợ hợp lệ từ tiền đặt cọc theo Điều 5.', '- Chấm dứt hợp đồng, yêu cầu bàn giao lại phòng theo thỏa thuận và quy định pháp luật.', '- Gửi đơn yêu cầu, khiếu nại, khởi kiện hoặc cung cấp các thông tin, tài liệu cần thiết cho cơ quan nhà nước có thẩm quyền để giải quyết tranh chấp và bảo vệ quyền, lợi ích hợp pháp của mình.' ].forEach((t) => li(1, t));
  li(0, '5. Bên B xác nhận các thông tin cá nhân, giấy tờ tùy thân, địa chỉ thường trú và số điện thoại cung cấp trong hợp đồng là chính xác. Khi phát sinh tranh chấp hoặc công nợ, Bên A được sử dụng và cung cấp những thông tin cần thiết này cho cơ quan có thẩm quyền, tổ chức hoặc cá nhân có liên quan theo quy định pháp luật nhằm xác minh thông tin, yêu cầu thanh toán và giải quyết tranh chấp.');
  h('ĐIỀU 9. CHẤM DỨT HỢP ĐỒNG');
  li(0, '1. Hợp đồng chấm dứt khi:');
  [ '- Hai bên thỏa thuận chấm dứt hợp đồng.', '- Bên B không thực hiện nghĩa vụ thanh toán theo hợp đồng và thuộc trường hợp Bên A được quyền chấm dứt hợp đồng theo thỏa thuận, quy định pháp luật.', '- Một trong hai bên có quyền đơn phương chấm dứt hợp đồng theo quy định pháp luật.', '- Các trường hợp khác theo quy định pháp luật.' ].forEach((t) => li(1, t));
  li(0, '2. Trường hợp Bên A có nhu cầu lấy lại phòng trước thời hạn hoặc Bên B có nhu cầu trả phòng trước thời hạn, bên có nhu cầu phải thông báo cho bên còn lại trước ít nhất ', { b: '30 ngày' }, ', trừ trường hợp hai bên có thỏa thuận khác hoặc pháp luật có quy định khác.');
  li(0, '3. Khi chấm dứt hợp đồng, hai bên có trách nhiệm đối chiếu tiền thuê, điện, nước, các khoản công nợ, tình trạng phòng và tiền đặt cọc.');
  li(0, '4. Bên B có trách nhiệm bàn giao lại phòng, chìa khóa và tài sản đã nhận khi kết thúc hợp đồng.');
  h('ĐIỀU 10. CAM KẾT CHUNG');
  [ '1. Hai bên cam kết những thông tin cung cấp trong hợp đồng là đúng sự thật và tự nguyện ký kết.',
    '2. Bên B cam kết chịu trách nhiệm về việc sử dụng phòng và việc chấp hành nội quy của những người cùng ở trong phạm vi nghĩa vụ của mình theo hợp đồng và pháp luật.',
    '3. Mọi sửa đổi, bổ sung hợp đồng phải được hai bên thống nhất và xác nhận bằng văn bản hoặc hình thức có thể lưu trữ, đối chiếu.',
    '4. Trường hợp phát sinh tranh chấp, hai bên ưu tiên thương lượng trên tinh thần thiện chí. Nếu không giải quyết được, tranh chấp sẽ được xử lý theo quy định pháp luật Việt Nam.',
    '5. Hợp đồng có hiệu lực kể từ ngày ký, được lập thành 02 bản có giá trị như nhau, mỗi bên giữ 01 bản để thực hiện.' ].forEach((t) => li(0, t));
  p('Hai bên đã đọc, hiểu rõ toàn bộ nội dung hợp đồng, đồng ý với các điều khoản và cùng ký tên dưới đây.');
  B.push({ t: 'sign', left: ['BÊN THUÊ PHÒNG (BÊN B)', '(Ký và ghi rõ họ tên)', T.fullName || ''], right: ['BÊN CHO THUÊ (BÊN A)', '(Ký và ghi rõ họ tên)', L.fullName || ''] });
  return B;
}

// ---------- HTML (in / lưu PDF) ----------
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const runsHtml = (runs) => (Array.isArray(runs) ? runs : [runs]).map((r) => (typeof r === 'string' ? esc(r) : r && r.b !== undefined ? `<b class="f">${esc(r.b)}</b>` : '')).join('');
export function contractHtml(blocks, title = 'Hợp đồng thuê phòng trọ') {
  const body = blocks.map((b) => {
    if (b.t === 'c') return `<p class="c${b.big ? ' big' : ''}">${b.bold ? `<b>${runsHtml(b.text)}</b>` : runsHtml(b.text)}</p>`;
    if (b.t === 'hr') return '<div class="hr"></div>';
    if (b.t === 'h') return `<h3>${esc(b.text)}</h3>`;
    if (b.t === 'p') return `<p>${runsHtml(b.runs)}</p>`;
    if (b.t === 'li') return `<p class="li l${b.level}">${runsHtml(b.runs)}</p>`;
    if (b.t === 'table') { const tot = b.widths.reduce((a, x) => a + x, 0); return `<table class="grid"><colgroup>${b.widths.map((w) => `<col style="width:${(w / tot * 100).toFixed(1)}%">`).join('')}</colgroup><thead><tr>${b.head.map((x) => `<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((x, i) => `<td${i === 0 ? ' class="cc"' : ''}>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`; }
    if (b.t === 'sign') return `<table class="sign"><tr><td><b>${esc(b.left[0])}</b><br><i>${esc(b.left[1])}</i><div class="sp"></div><b>${esc(b.left[2])}</b></td><td><b>${esc(b.right[0])}</b><br><i>${esc(b.right[1])}</i><div class="sp"></div><b>${esc(b.right[2])}</b></td></tr></table>`;
    return '';
  }).join('\n');
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
@page{size:A4;margin:20mm 20mm 20mm 30mm}
*{box-sizing:border-box}body{font-family:"Times New Roman",Times,"Liberation Serif",serif;font-size:13pt;line-height:1.35;color:#000;margin:0;padding:0}
p{margin:0 0 5pt;text-align:justify}.c{text-align:center;margin:0 0 3pt}.big{font-size:16pt;margin-top:14pt}
.hr{width:36%;border-top:1px solid #000;margin:4pt auto 12pt}
h3{font-size:13pt;margin:13pt 0 6pt;text-transform:none;break-after:avoid}
.li{padding-left:0}.li.l1{padding-left:9mm}.f{font-weight:700}
table{border-collapse:collapse;width:100%}
.grid{margin:6pt 0 8pt;font-size:10.5pt}.grid th,.grid td{border:1px solid #000;padding:3pt 4pt;vertical-align:top;word-break:break-word}.grid th{background:#eee;text-align:center}.cc{text-align:center}
.sign{margin-top:22pt;break-inside:avoid}.sign td{width:50%;text-align:center;vertical-align:top}.sign .sp{height:70pt}
@media screen{body{max-width:210mm;margin:0 auto;padding:20mm 20mm 20mm 30mm;background:#fff}}
</style></head><body>${body}</body></html>`;
}

// ---------- Word (.docx) ----------
const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const x = (s) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const run = (text, o = {}) => `<w:r><w:rPr>${o.b ? '<w:b/>' : ''}${o.i ? '<w:i/>' : ''}${o.sz ? `<w:sz w:val="${o.sz}"/>` : ''}</w:rPr><w:t xml:space="preserve">${x(text)}</w:t></w:r>`;
const runsDoc = (runs, base = {}) => (Array.isArray(runs) ? runs : [runs]).map((r) => (typeof r === 'string' ? run(r, base) : r && r.b !== undefined ? run(r.b, { ...base, b: true }) : '')).join('');
const para = (inner, o = {}) => `<w:p><w:pPr>${o.keep ? '<w:keepNext/>' : ''}${o.border ? '<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="000000"/></w:pBdr>' : ''}<w:spacing w:before="${o.before || 0}" w:after="${o.after ?? 80}" w:line="300" w:lineRule="auto"/>${o.ind ? `<w:ind w:left="${o.ind}" ${o.right ? `w:right="${o.right}"` : ''}/>` : ''}<w:jc w:val="${o.jc || 'both'}"/></w:pPr>${inner}</w:p>`;
const cell = (inner, w, o = {}) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${o.shade ? '<w:shd w:val="clear" w:color="auto" w:fill="EEEEEE"/>' : ''}</w:tcPr>${inner}</w:tc>`;
export function contractDocx(blocks) {
  const out = [];
  for (const b of blocks) {
    if (b.t === 'c') out.push(para(runsDoc(b.text, { b: !!b.bold, sz: b.big ? 32 : 0 }), { jc: 'center', after: b.big ? 60 : 40, before: b.big ? 240 : 0 }));
    else if (b.t === 'hr') out.push(para('', { ind: 3300, right: 3300, border: true, after: 220, jc: 'center' }));
    else if (b.t === 'h') out.push(para(run(b.text, { b: true }), { before: 240, after: 100, keep: true, jc: 'left' }));
    else if (b.t === 'p') out.push(para(runsDoc(b.runs)));
    else if (b.t === 'li') out.push(para(runsDoc(b.runs), { ind: b.level ? 510 : 0 }));
    else if (b.t === 'table') {
      const bd = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((k) => `<w:${k} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`).join('');
      const tot = b.widths.reduce((a, w) => a + w, 0);
      const rows = [b.head, ...b.rows].map((r, ri) => `<w:tr>${ri === 0 ? '<w:trPr><w:tblHeader/></w:trPr>' : '<w:trPr><w:cantSplit/></w:trPr>'}${r.map((t, i) => cell(para(run(t, { b: ri === 0, sz: 20 }), { jc: ri === 0 || i === 0 ? 'center' : 'left', after: 20 }), b.widths[i], { shade: ri === 0 })).join('')}</w:tr>`).join('');
      out.push(`<w:tbl><w:tblPr><w:tblW w:w="${tot}" w:type="dxa"/><w:tblBorders>${bd}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="70" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${b.widths.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows}</w:tbl>`, para('', { after: 60 }));
    } else if (b.t === 'sign') {
      const col = (a) => `${para(run(a[0], { b: true }), { jc: 'center', after: 0, keep: true })}${para(run(a[1], { i: true }), { jc: 'center', after: 0, keep: true })}${para('', { after: 1100, keep: true })}${para(run(a[2], { b: true }), { jc: 'center', after: 0 })}`;
      out.push(para('', { after: 160 }), `<w:tbl><w:tblPr><w:tblW w:w="9071" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid><w:gridCol w:w="4535"/><w:gridCol w:w="4536"/></w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr>${cell(col(b.left), 4535)}${cell(col(b.right), 4536)}</w:tr></w:tbl>`, para('', { after: 0 }));
    }
  }
  const document = `${X}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${out.join('')}<w:sectPr><w:footerReference w:type="default" r:id="rId2"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1701" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const fonts = '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman"/>';
  const files = [
    ['[Content_Types].xml', `${X}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`],
    ['_rels/.rels', `${X}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`],
    ['word/_rels/document.xml.rels', `${X}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`],
    ['word/styles.xml', `${X}<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr>${fonts}<w:sz w:val="26"/><w:szCs w:val="26"/><w:lang w:val="vi-VN" w:eastAsia="vi-VN" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`],
    ['word/footer1.xml', `${X}<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">Trang </w:t></w:r><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>1</w:t></w:r><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`],
    ['word/document.xml', document],
  ];
  return zip(files);
}
