fn main() {
    // Build the ggwave static library from the vendored source cloned next to this crate.
    // The repository was cloned to `../ggwave`.
    let ggwave_dir = std::path::Path::new("..").join("ggwave");
    let src = ggwave_dir.join("src").join("ggwave.cpp");
    let include = ggwave_dir.join("include");

    if !src.exists() {
        panic!("Expected ggwave source at {}", src.display());
    }

    let mut build = cc::Build::new();
    build.cpp(true)
        .file(src)
        .include(include)
        .flag_if_supported("-std=c++11")
        .define("GGWAVE_BUILD", None);

    // On MSVC, enable multi-processor compilation if possible
    #[cfg(target_env = "msvc")]
    {
        build.flag("/MP");
    }

    build.compile("ggwave");
}

