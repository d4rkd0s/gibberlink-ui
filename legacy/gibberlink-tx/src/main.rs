use clap::Parser;
use std::ffi::c_int;
use std::fs::File;
use std::io::{BufReader, BufWriter, Read, Write};
use std::path::PathBuf;

#[repr(C)]
#[derive(Clone, Copy, Debug)]
struct GgwaveParameters {
    payloadLength: c_int,
    sampleRateInp: f32,
    sampleRateOut: f32,
    sampleRate: f32,
    samplesPerFrame: c_int,
    soundMarkerThreshold: f32,
    sampleFormatInp: c_int,
    sampleFormatOut: c_int,
    operatingMode: c_int,
}

#[allow(non_camel_case_types)]
type ggwave_Instance = c_int;

// Enums from ggwave.h
#[allow(non_camel_case_types)]
mod ggwave_consts {
    pub const GGWAVE_SAMPLE_FORMAT_UNDEFINED: i32 = 0;
    pub const GGWAVE_SAMPLE_FORMAT_U8: i32 = 1;
    pub const GGWAVE_SAMPLE_FORMAT_I8: i32 = 2;
    pub const GGWAVE_SAMPLE_FORMAT_U16: i32 = 3;
    pub const GGWAVE_SAMPLE_FORMAT_I16: i32 = 4;
    pub const GGWAVE_SAMPLE_FORMAT_F32: i32 = 5;

    pub const GGWAVE_PROTOCOL_AUDIBLE_NORMAL: i32 = 0;
    pub const GGWAVE_PROTOCOL_AUDIBLE_FAST: i32 = 1;
    pub const GGWAVE_PROTOCOL_AUDIBLE_FASTEST: i32 = 2;
    pub const GGWAVE_PROTOCOL_ULTRASOUND_NORMAL: i32 = 3;
    pub const GGWAVE_PROTOCOL_ULTRASOUND_FAST: i32 = 4;
    pub const GGWAVE_PROTOCOL_ULTRASOUND_FASTEST: i32 = 5;
    pub const GGWAVE_PROTOCOL_DT_NORMAL: i32 = 6;
    pub const GGWAVE_PROTOCOL_DT_FAST: i32 = 7;
    pub const GGWAVE_PROTOCOL_DT_FASTEST: i32 = 8;
    pub const GGWAVE_PROTOCOL_MT_NORMAL: i32 = 9;
    pub const GGWAVE_PROTOCOL_MT_FAST: i32 = 10;
    pub const GGWAVE_PROTOCOL_MT_FASTEST: i32 = 11;

    pub const GGWAVE_OPERATING_MODE_RX: i32 = 1 << 1;
    pub const GGWAVE_OPERATING_MODE_TX: i32 = 1 << 2;
    pub const GGWAVE_OPERATING_MODE_RX_AND_TX: i32 = GGWAVE_OPERATING_MODE_RX | GGWAVE_OPERATING_MODE_TX;
}

#[link(name = "ggwave")]
extern "C" {
    fn ggwave_getDefaultParameters() -> GgwaveParameters;
    fn ggwave_setLogFile(fptr: *mut core::ffi::c_void);
    fn ggwave_init(parameters: GgwaveParameters) -> ggwave_Instance;
    fn ggwave_free(instance: ggwave_Instance);
    fn ggwave_encode(
        instance: ggwave_Instance,
        payloadBuffer: *const core::ffi::c_void,
        payloadSize: c_int,
        protocolId: c_int,
        volume: c_int,
        waveformBuffer: *mut core::ffi::c_void,
        query: c_int,
    ) -> c_int;
    fn ggwave_ndecode(
        instance: ggwave_Instance,
        waveformBuffer: *const core::ffi::c_void,
        waveformSize: c_int,
        payloadBuffer: *mut core::ffi::c_void,
        payloadSize: c_int,
    ) -> c_int;
}

#[derive(Parser, Debug)]
#[command(name = "gibberlink-tx", about = "Text → Gibberlink (ggwave) audio generator and player")]
struct Args {
    /// Text to encode. If omitted, reads from stdin.
    #[arg(short, long)]
    text: Option<String>,

    /// Output WAV file path
    #[arg(short, long, default_value = "gibberlink.wav")]
    out: PathBuf,

    /// Protocol: audible|ultrasound|dt|mt (normal|fast|fastest)
    #[arg(long, default_value = "audible:fast")] 
    protocol: String,

    /// Volume [0..100]
    #[arg(long, default_value_t = 25)]
    volume: i32,

    /// Sample rate for output
    #[arg(long)]
    sample_rate: Option<u32>,

    /// Play after generating
    #[arg(long, default_value_t = true)]
    play: bool,

    /// Decode payload from WAV file and print as text
    #[arg(long, value_name = "WAV")]
    decode_wav: Option<PathBuf>,
}

fn parse_protocol(s: &str) -> i32 {
    use ggwave_consts::*;
    let (family, speed) = if let Some((a, b)) = s.split_once(':') { (a, b) } else { (s, "normal") };
    match (family.to_ascii_lowercase().as_str(), speed.to_ascii_lowercase().as_str()) {
        ("audible", "normal") => GGWAVE_PROTOCOL_AUDIBLE_NORMAL,
        ("audible", "fast") => GGWAVE_PROTOCOL_AUDIBLE_FAST,
        ("audible", "fastest") => GGWAVE_PROTOCOL_AUDIBLE_FASTEST,
        ("ultrasound", "normal") => GGWAVE_PROTOCOL_ULTRASOUND_NORMAL,
        ("ultrasound", "fast") => GGWAVE_PROTOCOL_ULTRASOUND_FAST,
        ("ultrasound", "fastest") => GGWAVE_PROTOCOL_ULTRASOUND_FASTEST,
        ("dt", "normal") => GGWAVE_PROTOCOL_DT_NORMAL,
        ("dt", "fast") => GGWAVE_PROTOCOL_DT_FAST,
        ("dt", "fastest") => GGWAVE_PROTOCOL_DT_FASTEST,
        ("mt", "normal") => GGWAVE_PROTOCOL_MT_NORMAL,
        ("mt", "fast") => GGWAVE_PROTOCOL_MT_FAST,
        ("mt", "fastest") => GGWAVE_PROTOCOL_MT_FASTEST,
        _ => GGWAVE_PROTOCOL_AUDIBLE_FAST,
    }
}

fn write_wav(path: &PathBuf, sample_rate: u32, sample_format: i32, data: &[u8]) -> std::io::Result<()> {
    let mut writer = BufWriter::new(File::create(path)?);
    let num_channels: u16 = 1;
    let bits_per_sample: u16 = match sample_format {
        x if x == ggwave_consts::GGWAVE_SAMPLE_FORMAT_I16 => 16,
        x if x == ggwave_consts::GGWAVE_SAMPLE_FORMAT_U8 => 8,
        x if x == ggwave_consts::GGWAVE_SAMPLE_FORMAT_F32 => 32,
        x if x == ggwave_consts::GGWAVE_SAMPLE_FORMAT_I8 => 8,
        x if x == ggwave_consts::GGWAVE_SAMPLE_FORMAT_U16 => 16,
        _ => 16,
    };
    let byte_rate: u32 = sample_rate * num_channels as u32 * (bits_per_sample as u32 / 8);
    let block_align: u16 = num_channels * (bits_per_sample / 8);
    let data_len = data.len() as u32;
    let riff_chunk_size = 36 + data_len;

    // RIFF header
    writer.write_all(b"RIFF")?;
    writer.write_all(&riff_chunk_size.to_le_bytes())?;
    writer.write_all(b"WAVE")?;

    // fmt subchunk
    writer.write_all(b"fmt ")?;
    writer.write_all(&16u32.to_le_bytes())?; // Subchunk1Size for PCM
    writer.write_all(&1u16.to_le_bytes())?; // AudioFormat PCM
    writer.write_all(&num_channels.to_le_bytes())?;
    writer.write_all(&sample_rate.to_le_bytes())?;
    writer.write_all(&byte_rate.to_le_bytes())?;
    writer.write_all(&block_align.to_le_bytes())?;
    writer.write_all(&bits_per_sample.to_le_bytes())?;

    // data subchunk
    writer.write_all(b"data")?;
    writer.write_all(&data_len.to_le_bytes())?;
    writer.write_all(data)?;
    writer.flush()?;
    Ok(())
}

#[derive(Debug)]
struct WavData {
    sample_rate: u32,
    channels: u16,
    bits_per_sample: u16,
    format_tag: u16, // 1 = PCM, 3 = IEEE float
    data: Vec<u8>,
}

fn read_le_u16(buf: &[u8]) -> u16 { u16::from_le_bytes([buf[0], buf[1]]) }
fn read_le_u32(buf: &[u8]) -> u32 { u32::from_le_bytes([buf[0], buf[1], buf[2], buf[3]]) }

fn read_wav(path: &std::path::Path) -> Result<WavData, String> {
    let mut f = BufReader::new(File::open(path).map_err(|e| format!("open: {}", e))?);
    let mut header = [0u8; 12];
    f.read_exact(&mut header).map_err(|e| format!("read header: {}", e))?;
    if &header[0..4] != b"RIFF" || &header[8..12] != b"WAVE" {
        return Err("Not a RIFF/WAVE file".into());
    }
    let mut fmt_chunk_found = false;
    let mut data_chunk_found = false;
    let mut format_tag = 1u16;
    let mut channels = 1u16;
    let mut sample_rate = 44100u32;
    let mut bits_per_sample = 16u16;
    let mut data = Vec::new();

    loop {
        let mut chunk_hdr = [0u8; 8];
        if f.read_exact(&mut chunk_hdr).is_err() { break; }
        let id = &chunk_hdr[0..4];
        let len = read_le_u32(&chunk_hdr[4..8]) as usize;
        let mut chunk = vec![0u8; len];
        f.read_exact(&mut chunk).map_err(|e| format!("read chunk: {}", e))?;
        if len % 2 == 1 { let mut pad = [0u8; 1]; let _ = f.read_exact(&mut pad); }
        if id == b"fmt " {
            if len < 16 { return Err("fmt chunk too small".into()); }
            format_tag = read_le_u16(&chunk[0..2]);
            channels = read_le_u16(&chunk[2..4]);
            sample_rate = read_le_u32(&chunk[4..8]);
            bits_per_sample = read_le_u16(&chunk[14..16]);
            fmt_chunk_found = true;
        } else if id == b"data" {
            data = chunk;
            data_chunk_found = true;
        }
        if fmt_chunk_found && data_chunk_found { break; }
    }
    if !fmt_chunk_found || !data_chunk_found {
        return Err("Missing fmt or data chunk".into());
    }
    Ok(WavData { sample_rate, channels, bits_per_sample, format_tag, data })
}

fn downmix_to_mono(w: &WavData) -> Result<(i32, Vec<u8>), String> {
    use ggwave_consts::*;
    if w.channels == 1 {
        let fmt = match (w.format_tag, w.bits_per_sample) {
            (1, 8) => GGWAVE_SAMPLE_FORMAT_U8,
            (1, 16) => GGWAVE_SAMPLE_FORMAT_I16,
            (3, 32) => GGWAVE_SAMPLE_FORMAT_F32,
            _ => return Err(format!("Unsupported WAV format tag {} bits {}", w.format_tag, w.bits_per_sample)),
        };
        return Ok((fmt, w.data.clone()));
    }
    match (w.format_tag, w.bits_per_sample) {
        (1, 16) => {
            let frame_count = w.data.len() / (2 * w.channels as usize);
            let mut out = Vec::with_capacity(frame_count * 2);
            for i in 0..frame_count {
                let mut acc: i32 = 0;
                for ch in 0..w.channels as usize {
                    let idx = (i * w.channels as usize + ch) * 2;
                    let s = i16::from_le_bytes([w.data[idx], w.data[idx+1]]) as i32;
                    acc += s;
                }
                let avg = (acc / (w.channels as i32)).clamp(i16::MIN as i32, i16::MAX as i32) as i16;
                out.extend_from_slice(&avg.to_le_bytes());
            }
            Ok((GGWAVE_SAMPLE_FORMAT_I16, out))
        }
        (1, 8) => {
            let frame_count = w.data.len() / (1 * w.channels as usize);
            let mut out = Vec::with_capacity(frame_count);
            for i in 0..frame_count {
                let mut acc: i32 = 0;
                for ch in 0..w.channels as usize {
                    let idx = i * w.channels as usize + ch;
                    let s = w.data[idx] as i32;
                    acc += s;
                }
                let avg = (acc / (w.channels as i32)).clamp(0, 255) as u8;
                out.push(avg);
            }
            Ok((GGWAVE_SAMPLE_FORMAT_U8, out))
        }
        (3, 32) => {
            let frame_count = w.data.len() / (4 * w.channels as usize);
            let mut out = Vec::with_capacity(frame_count * 4);
            for i in 0..frame_count {
                let mut acc: f32 = 0.0;
                for ch in 0..w.channels as usize {
                    let idx = (i * w.channels as usize + ch) * 4;
                    let s = f32::from_le_bytes([w.data[idx], w.data[idx+1], w.data[idx+2], w.data[idx+3]]);
                    acc += s;
                }
                let avg = acc / (w.channels as f32);
                out.extend_from_slice(&avg.to_le_bytes());
            }
            Ok((GGWAVE_SAMPLE_FORMAT_F32, out))
        }
        _ => Err(format!("Unsupported multi-channel WAV format tag {} bits {}", w.format_tag, w.bits_per_sample)),
    }
}

fn decode_wav_with_ggwave(path: &std::path::Path) -> Result<Vec<u8>, String> {
    let wav = read_wav(path)?;
    let (sample_format_inp, mono_bytes) = downmix_to_mono(&wav)?;
    unsafe {
        let mut params = ggwave_getDefaultParameters();
        params.operatingMode = ggwave_consts::GGWAVE_OPERATING_MODE_RX;
        params.sampleFormatInp = sample_format_inp;
        params.sampleRateInp = wav.sample_rate as f32;
        params.sampleRate = wav.sample_rate as f32;

        let instance = ggwave_init(params);
        if instance < 0 { return Err("ggwave init failed".into()); }

        let mut cap = 256usize;
        let decoded = loop {
            let mut out = vec![0u8; cap];
            let n = ggwave_ndecode(
                instance,
                mono_bytes.as_ptr() as *const _,
                mono_bytes.len() as c_int,
                out.as_mut_ptr() as *mut _,
                out.len() as c_int,
            );
            if n == -2 { cap *= 2; if cap > 65536 { break Err("Decoded payload too large".into()); } continue; }
            if n <= 0 { break Err("No payload decoded".into()); }
            out.truncate(n as usize);
            break Ok(out);
        };
        ggwave_free(instance);
        decoded
    }
}

#[cfg(target_os = "windows")]
fn play_wav_blocking(path: &std::path::Path) -> Result<(), String> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use std::ptr::null_mut;

    const SND_SYNC: u32 = 0x0000;
    const SND_FILENAME: u32 = 0x00020000;

    #[link(name = "winmm")]
    extern "system" {
        fn PlaySoundW(pszSound: *const u16, hmod: *mut core::ffi::c_void, fdwSound: u32) -> i32;
    }

    let widestr: Vec<u16> = OsStr::new(path)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let ok = unsafe { PlaySoundW(widestr.as_ptr(), null_mut(), SND_SYNC | SND_FILENAME) };
    if ok == 0 { Err("PlaySoundW failed".into()) } else { Ok(()) }
}

#[cfg(not(target_os = "windows"))]
fn play_wav_blocking(path: &std::path::Path) -> Result<(), String> {
    // Fallback: try to spawn `ffplay` or `aplay` if available
    let candidates = [
        ("ffplay", &["-nodisp", "-autoexit"] as &[&str]),
        ("aplay", &[] as &[&str]),
        ("afplay", &[] as &[&str]),
        ("paplay", &[] as &[&str]),
    ];
    for (cmd, args) in candidates {
        if std::process::Command::new(cmd)
            .args(args)
            .arg(path)
            .spawn()
            .map(|mut c| c.wait().map(|s| s.success()).unwrap_or(false))
            .unwrap_or(false)
        {
            return Ok(());
        }
    }
    Err("No audio player found".into())
}

fn main() {
    let args = Args::parse();
    unsafe { ggwave_setLogFile(std::ptr::null_mut()); }

    // Decode mode
    if let Some(wav) = args.decode_wav.as_ref() {
        match decode_wav_with_ggwave(wav.as_path()) {
            Ok(bytes) => {
                match String::from_utf8(bytes.clone()) {
                    Ok(s) => { println!("{}", s); }
                    Err(_) => {
                        print!("0x");
                        for b in bytes { print!("{:02x}", b); }
                        println!();
                    }
                }
                return;
            }
            Err(e) => {
                eprintln!("Decode failed: {}", e);
                std::process::exit(6);
            }
        }
    }

    // Read text
    let text = match args.text {
        Some(t) => t,
        None => {
            let mut buf = String::new();
            std::io::stdin().read_to_string(&mut buf).expect("failed to read stdin");
            buf.trim_end().to_owned()
        }
    };
    if text.is_empty() {
        eprintln!("No text provided");
        std::process::exit(1);
    }

    unsafe {
        let mut params = ggwave_getDefaultParameters();
        // TX only, mono 16-bit output
        params.operatingMode = ggwave_consts::GGWAVE_OPERATING_MODE_TX;
        params.sampleFormatOut = ggwave_consts::GGWAVE_SAMPLE_FORMAT_I16;
        if let Some(sr) = args.sample_rate { params.sampleRateOut = sr as f32; params.sampleRate = sr as f32; }

        let instance = ggwave_init(params);
        if instance < 0 {
            eprintln!("Failed to init ggwave");
            std::process::exit(2);
        }

        let payload = text.as_bytes();
        let protocol = parse_protocol(&args.protocol);
        let volume = args.volume.clamp(0, 100);

        // Query size
        let nbytes = ggwave_encode(
            instance,
            payload.as_ptr() as *const _,
            payload.len() as c_int,
            protocol,
            volume,
            std::ptr::null_mut(),
            1,
        );
        if nbytes <= 0 {
            ggwave_free(instance);
            eprintln!("ggwave_encode size query failed");
            std::process::exit(3);
        }

        let mut buf = vec![0u8; nbytes as usize];
        let nwritten = ggwave_encode(
            instance,
            payload.as_ptr() as *const _,
            payload.len() as c_int,
            protocol,
            volume,
            buf.as_mut_ptr() as *mut _,
            0,
        );
        if nwritten != nbytes {
            ggwave_free(instance);
            eprintln!("ggwave_encode wrote {} but expected {}", nwritten, nbytes);
            std::process::exit(4);
        }

        ggwave_free(instance);

        // Write WAV
        if let Err(e) = write_wav(&args.out, params.sampleRateOut as u32, params.sampleFormatOut, &buf) {
            eprintln!("Failed to write WAV: {}", e);
            std::process::exit(5);
        }

        println!("Wrote {} bytes to {}", buf.len(), args.out.display());

        if args.play {
            if let Err(e) = play_wav_blocking(&args.out) {
                eprintln!("Playback failed: {}", e);
            }
        }
    }
}
