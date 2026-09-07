package com.kccitm.api.archtest;

import java.io.DataInputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

import com.tngtech.archunit.core.domain.JavaClass;

/**
 * ArchUnit models types, members and calls, but not the string literals inside a method body.
 * The literals live in the class file's constant pool, so read them straight from there: a
 * minimal parser that walks the pool and collects every UTF-8 entry (tag 1).
 *
 * <p>The result is a superset of the literals — it also contains type descriptors, member names
 * and annotation values — which is fine for a "does any string in this class contain X" check.
 */
final class ConstantPool {

    private ConstantPool() { }

    static List<String> strings(JavaClass cls) {
        List<String> out = new ArrayList<>();
        if (!cls.getSource().isPresent()) return out;
        try (InputStream in = cls.getSource().get().getUri().toURL().openStream();
                DataInputStream d = new DataInputStream(in)) {
            d.readInt();                // magic
            d.readUnsignedShort();      // minor version
            d.readUnsignedShort();      // major version
            int n = d.readUnsignedShort();
            for (int i = 1; i < n; i++) {
                int tag = d.readUnsignedByte();
                switch (tag) {
                    case 1: out.add(d.readUTF()); break;
                    case 3: case 4: d.readInt(); break;
                    case 5: case 6: d.readLong(); i++; break;
                    case 7: case 8: case 16: case 19: case 20: d.readUnsignedShort(); break;
                    case 9: case 10: case 11: case 12: case 17: case 18: d.readInt(); break;
                    case 15: d.readUnsignedByte(); d.readUnsignedShort(); break;
                    default: return out;
                }
            }
        } catch (Exception e) {
            /* unreadable class: nothing to check */
        }
        return out;
    }
}
