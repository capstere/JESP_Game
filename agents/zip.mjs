// Uncompressed ZIP writer; no dependencies, network, or executable archive paths.
export function zipFiles(files){
 const encoder=new TextEncoder(), parts=[], central=[];let offset=0;
 const crc=bytes=>{let n=0xffffffff;for(const b of bytes){n^=b;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);}return (n^0xffffffff)>>>0;};
 const header=(length)=>{const bytes=new Uint8Array(length);return [bytes,new DataView(bytes.buffer)];};
 for(const f of files){const name=encoder.encode(f.name),data=encoder.encode(f.content),checksum=crc(data);
  const [a,v]=header(30);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x0800,true);v.setUint16(12,33,true);v.setUint32(14,checksum,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);parts.push(a,name,data);
  const [b,w]=header(46);w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint16(8,0x0800,true);w.setUint16(14,33,true);w.setUint32(16,checksum,true);w.setUint32(20,data.length,true);w.setUint32(24,data.length,true);w.setUint16(28,name.length,true);w.setUint32(42,offset,true);central.push(b,name);offset+=a.length+name.length+data.length;
 }
 const length=central.reduce((n,p)=>n+p.length,0);const [end,v]=header(22);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,length,true);v.setUint32(16,offset,true);
 return new Blob([...parts,...central,end],{type:'application/zip'});
}
