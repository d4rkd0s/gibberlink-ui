use clap::Parser;
use std::ffi::c_int;
use std::fs::File;
use std::io::{BufWriter, Write};
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

    // Read text
    let text = match args.text {
        Some(t) => t,
        None => {
            // Read from stdin
            use std::io::Read;
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
