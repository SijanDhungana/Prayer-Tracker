const fs=require("fs"), path=require("path");
const {Document,Packer,Paragraph,TextRun,ExternalHyperlink,HeadingLevel,AlignmentType,
       Table,TableRow,TableCell,WidthType,ShadingType,BorderStyle}=require("docx");

const INK="1A1A1A", MUTED="5A5A5A", HEAD="E8E8E8", LINK="1F5C8B", PAGE_W=9360;

// --- inline: **bold**, `code`, [text](url), *italic*
function inline(s,o={}){
  const out=[]; let i=0;
  const re=/(\*\*[^*]+\*\*)|(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(~~[^~]+~~)|(\*[^*]+\*)/g;
  let m;
  const push=(t,x={})=>{ if(t) out.push(new TextRun({text:t,size:o.size??19,color:x.color??o.color??INK,
      bold:x.bold||o.bold,italics:x.italics||o.italics,strike:x.strike,font:x.font??"Calibri"})); };
  while((m=re.exec(s))){
    push(s.slice(i,m.index)); i=m.index+m[0].length;
    const t=m[0];
    if(t.startsWith("**")) push(t.slice(2,-2),{bold:true});
    else if(t.startsWith("`")) push(t.slice(1,-1),{font:"Consolas",color:MUTED});
    else if(t.startsWith("~~")) push(t.slice(2,-2),{strike:true,color:MUTED});
    else if(t.startsWith("[")){
      const mm=/\[([^\]]+)\]\(([^)]+)\)/.exec(t);
      out.push(new ExternalHyperlink({link:mm[2],children:[new TextRun({text:mm[1],
        size:o.size??19,color:LINK,underline:{},font:"Calibri"})]}));
    } else push(t.slice(1,-1),{italics:true});
  }
  push(s.slice(i));
  return out.length?out:[new TextRun({text:"",size:o.size??19,font:"Calibri"})];
}
const para=(s,o={})=>new Paragraph({spacing:{after:o.after??110,line:274},children:inline(s,o)});
const head=(s,lvl)=>new Paragraph({heading:lvl===1?HeadingLevel.HEADING_1:lvl===2?HeadingLevel.HEADING_2:HeadingLevel.HEADING_3,
  spacing:{before:lvl===2?340:260,after:140},
  children:[new TextRun({text:s,size:lvl===2?27:lvl===3?23:34,bold:true,color:INK,font:"Calibri"})]});
const bullet=(s)=>new Paragraph({bullet:{level:0},spacing:{after:60,line:266},children:inline(s,{size:18})});
const hr=()=>new Paragraph({spacing:{before:200,after:200},
  border:{top:{style:BorderStyle.SINGLE,size:6,color:"CCCCCC",space:10}},children:[]});

function table(rows){
  const cols=rows[0].length;
  const widths=cols===2?[6600,2760]:cols===3?[4200,1500,3660]:
    Array.from({length:cols},(_,i)=>i===0?Math.round(PAGE_W-(cols-1)*Math.floor(PAGE_W*0.62/(cols-1)))
      :Math.floor(PAGE_W*0.62/(cols-1)));
  const sum=widths.reduce((a,b)=>a+b,0); widths[0]+=PAGE_W-sum;
  return new Table({columnWidths:widths,width:{size:PAGE_W,type:WidthType.DXA},
    rows:rows.map((r,ri)=>new TableRow({tableHeader:ri===0,children:r.map((c,ci)=>new TableCell({
      width:{size:widths[ci],type:WidthType.DXA},
      shading:ri===0?{type:ShadingType.CLEAR,fill:HEAD,color:"auto"}:undefined,
      margins:{top:60,bottom:60,left:90,right:90},
      children:[new Paragraph({spacing:{after:0},children:inline(c,{size:17,bold:ri===0})})]}))}))});
}

const md=fs.readFileSync(process.argv[2],"utf8").split("\n");
const kids=[]; let i=0;
while(i<md.length){
  const l=md[i];
  if(/^\s*$/.test(l)){i++;continue;}
  if(/^---+\s*$/.test(l)){kids.push(hr());i++;continue;}
  let m;
  if((m=/^(#{1,3})\s+(.*)$/.exec(l))){kids.push(head(m[2],m[1].length));i++;continue;}
  if(/^\|/.test(l)){
    const rows=[];
    while(i<md.length&&/^\|/.test(md[i])){
      if(!/^\|[\s:|-]+\|$/.test(md[i]))
        rows.push(md[i].replace(/^\||\|$/g,"").split("|").map(c=>c.trim()));
      i++;
    }
    if(rows.length)kids.push(table(rows));
    kids.push(new Paragraph({spacing:{after:140},children:[]}));
    continue;
  }
  if(/^[-*]\s+/.test(l)){
    let t=l.replace(/^[-*]\s+/,""); i++;
    while(i<md.length&&/^\s{2,}\S/.test(md[i])){t+=" "+md[i].trim();i++;}
    kids.push(bullet(t)); continue;
  }
  if(/^>\s?/.test(l)){
    let t=l.replace(/^>\s?/,""); i++;
    while(i<md.length&&/^>\s?/.test(md[i])){t+=" "+md[i].replace(/^>\s?/,"").trim();i++;}
    kids.push(new Paragraph({spacing:{after:140},indent:{left:360},children:inline(t,{color:MUTED,italics:true})}));
    continue;
  }
  let t=l; i++;
  while(i<md.length&&md[i].trim()&&!/^(#|\||[-*]\s|>|---)/.test(md[i])){t+=" "+md[i].trim();i++;}
  kids.push(para(t));
}

const doc=new Document({styles:{default:{document:{run:{font:"Calibri",size:19,color:INK}}}},
  sections:[{properties:{page:{size:{width:12240,height:15840},margin:{top:1080,bottom:1080,left:1080,right:1080}}},children:kids}]});
Packer.toBuffer(doc).then(b=>{fs.writeFileSync(process.argv[3],b);
  console.log("wrote",process.argv[3],`(${(b.length/1024).toFixed(0)} KB, ${kids.length} blocks)`);});
