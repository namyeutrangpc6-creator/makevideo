
const $ = (id) => document.getElementById(id);

let sourceFile = null;
let scripts = [];
let voiceBlobs = new Map();
let outputBlobs = new Map();
let ffmpeg = null;
let ffmpegLoading = false;

const styles = [
  {name:'Hook vấn đề',instruction:'Mở đầu bằng một vấn đề đời thường mà sản phẩm có thể hỗ trợ.'},
  {name:'Lợi ích chính',instruction:'Tập trung vào lợi ích đã được cung cấp xác nhận.'},
  {name:'Trình diễn',instruction:'Kể theo trình tự trình diễn cách dùng.'},
  {name:'Tình huống',instruction:'Bắt đầu bằng tình huống sử dụng thực tế, không bịa lời chứng thực.'},
  {name:'Câu hỏi thường gặp',instruction:'Mở bằng câu hỏi người mua quan tâm rồi giải đáp dựa trên thông tin có sẵn.'},
  {name:'So sánh lựa chọn',instruction:'Nêu tiêu chí để người mua tự đánh giá, không bịa đối thủ hay số liệu.'},
  {name:'3 điểm đáng chú ý',instruction:'Trình bày ba điểm đáng chú ý nếu có đủ dữ kiện.'},
  {name:'Hướng dẫn nhanh',instruction:'Dựng thành hướng dẫn ngắn, từng bước.'},
  {name:'Giải quyết băn khoăn',instruction:'Đưa ra băn khoăn thường gặp và trả lời thận trọng.'},
  {name:'Lời nhắc mua hàng',instruction:'Giọng gần gũi, CTA tự nhiên, không tạo khan hiếm giả.'}
];

function setStatus(text,isError=false){
  $('statusLine').textContent=text;
  $('statusLine').style.color=isError?'#ff9a9a':'var(--muted)';
}

function fmtBytes(n){
  return n<1024*1024?(n/1024).toFixed(0)+' KB':(n/1024/1024).toFixed(1)+' MB';
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function getRequestedCount(){
  const n=Number.parseInt($('scriptCount')?.value||'5',10);
  return Number.isFinite(n)?Math.min(20,Math.max(1,n)):5;
}

function enableButtons(){
  const has=!!sourceFile;
  $('generateBtn').disabled=!has;
  $('demoBtn').disabled=!has;
  $('voiceAllBtn').disabled=!scripts.length;
  $('renderAllBtn').disabled=!scripts.length;
}

function loadSource(file){
  if(!file)return;
  if(!file.type.startsWith('video/')){
    setStatus('Hãy chọn một tệp video.',true);
    return;
  }
  sourceFile=file;
  $('preview').src=URL.createObjectURL(file);
  $('fileName').textContent=file.name;
  $('fileInfo').textContent=fmtBytes(file.size)+' · đang đọc thông tin…';
  $('videoMeta').classList.remove('hidden');
  $('dropzone').classList.add('hidden');
  $('preview').onloadedmetadata=()=>{
    $('fileInfo').textContent=`${$('preview').videoWidth}×${$('preview').videoHeight} · ${$('preview').duration.toFixed(1)} giây · ${fmtBytes(file.size)}`;
  };
  enableButtons();
  setStatus('Đã chọn video. Nhập mô tả sản phẩm rồi tạo kịch bản.');
}

$('videoFile').addEventListener('change',e=>loadSource(e.target.files[0]));

$('removeVideo').addEventListener('click',()=>{
  sourceFile=null;
  $('preview').removeAttribute('src');
  $('preview').load();
  $('videoMeta').classList.add('hidden');
  $('dropzone').classList.remove('hidden');
  $('videoFile').value='';
  enableButtons();
  setStatus('Chọn video và nhập mô tả để bắt đầu.');
});

const drop=$('dropzone');
drop.addEventListener('dragover',e=>{
  e.preventDefault();
  drop.classList.add('drag');
});
drop.addEventListener('dragleave',()=>drop.classList.remove('drag'));
drop.addEventListener('drop',e=>{
  e.preventDefault();
  drop.classList.remove('drag');
  loadSource(e.dataTransfer.files[0]);
});

async function extractFrames(file,count=4){
  const url=URL.createObjectURL(file);
  const video=document.createElement('video');
  video.muted=true;
  video.preload='metadata';
  video.src=url;
  video.playsInline=true;

  await new Promise((res,rej)=>{
    video.onloadedmetadata=res;
    video.onerror=rej;
  });

  const canvas=document.createElement('canvas');
  canvas.width=320;
  canvas.height=568;
  const ctx=canvas.getContext('2d');
  const frames=[];

  for(let i=0;i<count;i++){
    const t=Math.min(
      Math.max(.2,video.duration*(i+1)/(count+1)),
      Math.max(.2,video.duration-.15)
    );
    video.currentTime=t;
    await new Promise((res,rej)=>{
      video.onseeked=res;
      video.onerror=rej;
    });

    const scale=Math.max(
      canvas.width/video.videoWidth,
      canvas.height/video.videoHeight
    );
    const w=video.videoWidth*scale;
    const h=video.videoHeight*scale;
    ctx.fillStyle='#000';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(video,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
    frames.push(canvas.toDataURL('image/jpeg',.68));
  }

  URL.revokeObjectURL(url);
  return frames;
}

function buildDemoScripts(){
  const count=getRequestedCount();
  const brief=$('productBrief').value.trim()||'Sản phẩm trong video';
  const audience=$('audience').value.trim()||'người đang cân nhắc sản phẩm';
  const cta=$('cta').value.trim()||'Xem thông tin sản phẩm để biết thêm chi tiết';

  const hooks=[
    `Bạn đang tìm hiểu ${brief}?`,
    `Điểm đáng chú ý của ${brief} là gì?`,
    `Cùng xem cách sử dụng ${brief}.`,
    `Trong tình huống này, ${brief} có thể hữu ích ra sao?`,
    `Trước khi chọn ${brief}, hãy xem điều này.`,
    `Bạn có thể đánh giá ${brief} theo những tiêu chí nào?`,
    `Cùng điểm qua các chi tiết của ${brief}.`,
    `Đây là cách tìm hiểu ${brief} nhanh hơn.`,
    `Có vài điều nên kiểm tra khi chọn ${brief}.`,
    `Nếu đang cân nhắc ${brief}, hãy xem hết video.`
  ];

  scripts=Array.from({length:count},(_,i)=>{
    const st=styles[i%styles.length];
    return {
      id:i+1,
      title:st.name+(i>=styles.length?` (${Math.floor(i/styles.length)+1})`:''),
      hook:hooks[i%hooks.length],
      voiceover:`${st.instruction} Sản phẩm: ${brief}. Khán giả: ${audience}. Chỉ dùng thông tin đã cung cấp, không bịa tính năng, giá, chứng nhận hay lời chứng thực. ${cta}.`,
      angle:st.name,
      voiceStatus:'Chưa tạo'
    };
  });

  voiceBlobs.clear();
  outputBlobs.clear();
  renderScripts();
  setStatus(`Đã tạo ${scripts.length} kịch bản mẫu. Muốn AI viết nội dung, hãy cấu hình Worker API.`);
}

$('demoBtn').addEventListener('click',()=>{
  if(sourceFile)buildDemoScripts();
});

$('scriptCount').addEventListener('change',()=>{
  $('scriptCount').value=String(getRequestedCount());
});

$('generateBtn').addEventListener('click',async()=>{
  if(!sourceFile)return;

  const brief=$('productBrief').value.trim();
  if(!brief){
    setStatus('Nhập mô tả sản phẩm và thông tin chính xác trước.',true);
    return;
  }

  const base=$('apiBase').value.trim().replace(/\/$/,'');
  if(!base){
    setStatus('Nhập địa chỉ Worker API. Nếu chưa có Worker, dùng Kịch bản mẫu.',true);
    return;
  }

  try{
    $('generateBtn').disabled=true;
    const count=getRequestedCount();
    $('scriptCount').value=String(count);
    setStatus(`Đang lấy khung hình và yêu cầu AI tạo ${count} kịch bản…`);

    const frames=await extractFrames(sourceFile,4);
    const res=await fetch(base+'/api/scripts',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        brief,
        audience:$('audience').value.trim(),
        cta:$('cta').value.trim(),
        style:$('styleMix').value,
        count,
        frames
      })
    });

    const data=await res.json();
    if(!res.ok)throw new Error(data.error||`Worker trả về ${res.status}`);

    scripts=(data.scripts||[]).slice(0,count).map((s,i)=>({
      ...s,id:i+1,voiceStatus:'Chưa tạo'
    }));

    if(!scripts.length)throw new Error('AI không trả về kịch bản.');

    renderScripts();
    voiceBlobs.clear();
    outputBlobs.clear();
    setStatus(`AI đã tạo ${scripts.length} kịch bản. Kiểm tra nội dung trước khi tạo giọng.`);
  }catch(e){
    setStatus('Không tạo được kịch bản AI: '+e.message,true);
  }finally{
    enableButtons();
  }
});

function renderScripts(){
  const root=$('scriptList');
  root.innerHTML='';
  $('emptyState').classList.toggle('hidden',scripts.length>0);

  scripts.forEach((s,i)=>{
    const card=document.createElement('article');
    card.className='script-card';
    card.innerHTML=`
      <h3>${String(i+1).padStart(2,'0')} · ${escapeHtml(s.title||s.angle||'Phiên bản')}</h3>
      <p class="hook">${escapeHtml(s.hook||'')}</p>
      <label class="hint" for="script-${i}">Lời bình / kịch bản</label>
      <textarea id="script-${i}">${escapeHtml(s.voiceover||s.script||'')}</textarea>
      <div class="card-foot">
        <small id="voice-status-${i}">${escapeHtml(s.voiceStatus||'Chưa tạo')}</small>
        <button class="btn btn-quiet" data-voice="${i}">Tạo giọng đọc</button>
      </div>`;
    root.appendChild(card);

    card.querySelector('textarea').addEventListener('input',e=>{
      s.voiceover=e.target.value;
    });
    card.querySelector('[data-voice]').addEventListener('click',()=>generateVoice(i));
  });

  enableButtons();
}

async function generateVoice(i){
  const s=scripts[i];
  if(!s?.voiceover?.trim()){
    setStatus('Kịch bản đang trống.',true);
    return;
  }

  try{
    setVoiceStatus(i,'Đang tạo giọng Kokoro trên máy…');
    const res=await fetch('http://localhost:7861/tts/generate',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        text:s.voiceover,
        voice:$('voice').value,
        output_format:'mp3'
      })
    });

    if(!res.ok){
      const d=await res.json().catch(()=>({}));
      throw new Error(d.error||`Kokoro trả về HTTP ${res.status}`);
    }

    const blob=await res.blob();
    if(!blob.size)throw new Error('Kokoro trả về file âm thanh rỗng.');

    voiceBlobs.set(i,blob);
    s.voiceStatus='Đã tạo giọng Kokoro';
    setVoiceStatus(i,'Đã tạo giọng Kokoro');
    setStatus(`Đã tạo giọng Kokoro cho phiên bản ${i+1}.`);
  }catch(e){
    let msg=e.message||'Lỗi không xác định';
    if(e instanceof TypeError){
      msg='Không kết nối được proxy local. Kiểm tra Docker Kokoro ở cổng 7860 và proxy ở cổng 7861.';
    }
    setVoiceStatus(i,'Lỗi: '+msg);
    setStatus('Tạo giọng Kokoro thất bại: '+msg,true);
  }
}

function setVoiceStatus(i,t){
  const el=$('voice-status-'+i);
  if(el)el.textContent=t;
}

$('voiceAllBtn').addEventListener('click',async()=>{
  for(let i=0;i<scripts.length;i++){
    if(!voiceBlobs.has(i))await generateVoice(i);
  }
});

async function loadFFmpeg(){
  if(ffmpeg)return ffmpeg;
  if(ffmpegLoading)throw new Error('FFmpeg đang tải.');

  ffmpegLoading=true;
  setProgress(1,'Đang tải bộ xử lý video…');

  try{
    if(!window.FFmpegWASM||!window.FFmpegUtil){
      throw new Error('Không tải được thư viện FFmpeg từ CDN. Kiểm tra mạng.');
    }

    const {FFmpeg}=window.FFmpegWASM;
    const {toBlobURL}=window.FFmpegUtil;
    ffmpeg=new FFmpeg();

    ffmpeg.on('progress',({progress})=>{
      setProgress(
        Math.min(98,Math.max(1,Math.round(progress*100))),
        'Đang dựng video…'
      );
    });

    const base='https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';

    await ffmpeg.load({
      classWorkerURL:new URL('/814.ffmpeg.js',window.location.origin).href,
      coreURL:await toBlobURL(base+'/ffmpeg-core.js','text/javascript'),
      wasmURL:await toBlobURL(base+'/ffmpeg-core.wasm','application/wasm')
    });

    return ffmpeg;
  }finally{
    ffmpegLoading=false;
  }
}

function setProgress(p,t){
  $('renderProgress').classList.remove('hidden');
  $('progressText').textContent=t;
  $('progressPct').textContent=p+'%';
  $('progressBar').style.width=p+'%';
}

function addDownload(i,blob){
  const url=URL.createObjectURL(blob);
  outputBlobs.set(i,blob);

  const row=document.createElement('div');
  row.className='download-item';
  row.innerHTML=`
    <span>Video ${String(i+1).padStart(2,'0')} · ${escapeHtml(scripts[i].title||'Remix')}.mp4</span>
    <a href="${url}" download="remix-${String(i+1).padStart(2,'0')}.mp4">Tải MP4 ↓</a>`;

  $('downloads').appendChild(row);
}

$('renderAllBtn').addEventListener('click',async()=>{
  if(!sourceFile){
    setStatus('Chọn video gốc trước.',true);
    return;
  }
  if(!scripts.length)return;

  if(!scripts.every((_,i)=>voiceBlobs.has(i))){
    setStatus(`Hãy tạo giọng đọc cho đủ ${scripts.length} phiên bản trước khi dựng.`,true);
    return;
  }

  try{
    $('renderAllBtn').disabled=true;
    $('downloads').innerHTML='';

    const ff=await loadFFmpeg();
    const inputExt=(sourceFile.name.split('.').pop()||'mp4')
      .toLowerCase().replace(/[^a-z0-9]/g,'');
    const inName='source.'+inputExt;

    await ff.writeFile(inName,new Uint8Array(await sourceFile.arrayBuffer()));

    for(let i=0;i<scripts.length;i++){
      setProgress(Math.round(i/scripts.length*100),`Đang dựng video ${i+1}/${scripts.length}…`);

      const audioName=`voice-${i}.mp3`;
      const outName=`remix-${i+1}.mp4`;

      await ff.writeFile(audioName,new Uint8Array(await voiceBlobs.get(i).arrayBuffer()));

      const args=[
        '-i',inName,
        '-i',audioName,
        '-map','0:v:0',
        '-map','1:a:0',
        '-vf','scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
        '-shortest',
        '-c:v','libx264',
        '-preset','ultrafast',
        '-crf','25',
        '-c:a','aac',
        '-b:a','128k',
        '-movflags','+faststart',
        outName
      ];

      await ff.exec(args);
      const data=await ff.readFile(outName);
      addDownload(i,new Blob([data.buffer],{type:'video/mp4'}));
      await ff.deleteFile(audioName);
      await ff.deleteFile(outName);
    }

    setProgress(100,`Hoàn tất ${scripts.length} video.`);
    setStatus('Đã dựng xong. Xem trước từng file và tải MP4.');
  }catch(e){
    setStatus(
      'Dựng video thất bại: '+e.message+
      '. Nếu trình duyệt thiếu bộ nhớ, thử xử lý ít video hơn hoặc dùng máy tính mạnh hơn.',
      true
    );
  }finally{
    $('renderAllBtn').disabled=false;
  }
});

window.addEventListener('beforeunload',e=>{
  if(sourceFile&&scripts.length){
    e.preventDefault();
    e.returnValue='';
  }
});
