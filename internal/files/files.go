package files

import (
	"archive/zip"
	"errors"
	"io"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"strings"
)

var ErrInvalidPath = errors.New("invalid path")

type Entry struct {
	Name string `json:"name"`
	Path string `json:"path"`
	Dir  bool   `json:"dir"`
	Size int64  `json:"size"`
}

func Resolve(root, rel string) (string, error) {
	rel = strings.TrimSpace(rel)
	rel = strings.ReplaceAll(rel, "\\", "/")
	if rel == "." || rel == "./" {
		rel = ""
	}
	rel = strings.TrimPrefix(rel, "/")
	if strings.Contains(rel, "\x00") {
		return "", ErrInvalidPath
	}
	for _, part := range strings.Split(rel, "/") {
		if part == ".." {
			return "", ErrInvalidPath
		}
	}
	clean := path.Clean("/" + rel)
	if clean == "/" {
		clean = ""
	} else {
		clean = strings.TrimPrefix(clean, "/")
	}
	full := filepath.Join(root, filepath.FromSlash(clean))
	relToRoot, err := filepath.Rel(root, full)
	if err != nil || relToRoot == ".." || strings.HasPrefix(relToRoot, ".."+string(os.PathSeparator)) {
		return "", ErrInvalidPath
	}
	return full, nil
}

func List(root, rel string) ([]Entry, error) {
	dir, err := Resolve(root, rel)
	if err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	base := strings.Trim(strings.ReplaceAll(rel, "\\", "/"), "/")
	out := make([]Entry, 0, len(entries))
	for _, e := range entries {
		info, err := e.Info()
		if err != nil {
			continue
		}
		p := e.Name()
		if base != "" {
			p = base + "/" + e.Name()
		}
		size := int64(0)
		if !e.IsDir() {
			size = info.Size()
		}
		out = append(out, Entry{Name: e.Name(), Path: p, Dir: e.IsDir(), Size: size})
	}
	return out, nil
}

func Mkdir(root, rel string) error {
	dir, err := Resolve(root, rel)
	if err != nil {
		return err
	}
	return os.MkdirAll(dir, 0o755)
}

func WriteFile(root, rel string, data []byte) error {
	full, err := Resolve(root, rel)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		return err
	}
	return os.WriteFile(full, data, 0o644)
}

func Remove(root, rel string) error {
	if strings.Trim(strings.ReplaceAll(rel, "\\", "/"), "/") == "" {
		return ErrInvalidPath
	}
	full, err := Resolve(root, rel)
	if err != nil {
		return err
	}
	return os.RemoveAll(full)
}

func ReadFile(root, rel string) ([]byte, error) {
	full, err := Resolve(root, rel)
	if err != nil {
		return nil, err
	}
	return os.ReadFile(full)
}

func IsText(b []byte) bool {
	n := len(b)
	if n > 8000 {
		n = 8000
	}
	for i := 0; i < n; i++ {
		if b[i] == 0 {
			return false
		}
	}
	return true
}

func ExportZip(root string, w io.Writer) error {
	zw := zip.NewWriter(w)
	defer zw.Close()
	return filepath.WalkDir(root, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(root, p)
		if err != nil || rel == "." {
			return err
		}
		name := filepath.ToSlash(rel)
		if d.IsDir() {
			_, err := zw.Create(name + "/")
			return err
		}
		f, err := os.Open(p)
		if err != nil {
			return err
		}
		defer f.Close()
		fw, err := zw.Create(name)
		if err != nil {
			return err
		}
		_, err = io.Copy(fw, f)
		return err
	})
}

func ImportZip(root string, r io.ReaderAt, size int64) error {
	zr, err := zip.NewReader(r, size)
	if err != nil {
		return err
	}
	for _, f := range zr.File {
		name := strings.ReplaceAll(f.Name, "\\", "/")
		if strings.HasPrefix(name, "/") || strings.Contains(name, "..") {
			return ErrInvalidPath
		}
		name = strings.TrimPrefix(path.Clean("/"+name), "/")
		if name == "" || name == "." {
			continue
		}
		dest, err := Resolve(root, name)
		if err != nil {
			return err
		}
		if f.FileInfo().IsDir() || strings.HasSuffix(f.Name, "/") {
			if err := os.MkdirAll(dest, 0o755); err != nil {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
			return err
		}
		rc, err := f.Open()
		if err != nil {
			return err
		}
		out, err := os.OpenFile(dest, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o644)
		if err != nil {
			rc.Close()
			return err
		}
		_, err = io.Copy(out, rc)
		out.Close()
		rc.Close()
		if err != nil {
			return err
		}
	}
	return nil
}
