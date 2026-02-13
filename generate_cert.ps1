try {
    # 1. Create RSA Key
    $rsa = [System.Security.Cryptography.RSA]::Create(2048)
    
    # 2. Create Certificate Request
    $distinguishedName = [System.Security.Cryptography.X509Certificates.X500DistinguishedName]::new("CN=localhost")
    $request = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new($distinguishedName, $rsa, [System.Security.Cryptography.HashAlgorithmName]::SHA256, [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
    
    # 3. Create Self-Signed Certificate
    $notBefore = (Get-Date)
    $notAfter = (Get-Date).AddYears(1)
    $cert = $request.CreateSelfSigned($notBefore, $notAfter)
    
    # 4. Export Public Certificate (PEM)
    $certBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
    $certBase64 = [System.Convert]::ToBase64String($certBytes, [System.Base64FormattingOptions]::InsertLineBreaks)
    $certPem = "-----BEGIN CERTIFICATE-----`r`n$certBase64`r`n-----END CERTIFICATE-----"
    Set-Content -Path "cert.pem" -Value $certPem -Encoding Ascii
    Write-Host "Created cert.pem"
    
    # 5. Export Private Key (PKCS#8 for Python ssl compatibility)
    # Check if ExportPkcs8PrivateKey is available which it should be on modern systems
    if ($rsa.GetType().GetMethod("ExportPkcs8PrivateKey") -ne $null) {
        $keyBytes = $rsa.ExportPkcs8PrivateKey()
        $keyBase64 = [System.Convert]::ToBase64String($keyBytes, [System.Base64FormattingOptions]::InsertLineBreaks)
        $keyPem = "-----BEGIN PRIVATE KEY-----`r`n$keyBase64`r`n-----END PRIVATE KEY-----"
        Set-Content -Path "key.pem" -Value $keyPem -Encoding Ascii
        Write-Host "Created key.pem (PKCS#8)"
    } 
    # Fallback to RSAPrivateKey (PKCS#1) if needed
    elseif ($rsa.GetType().GetMethod("ExportRSAPrivateKey") -ne $null) {
        $keyBytes = $rsa.ExportRSAPrivateKey()
        $keyBase64 = [System.Convert]::ToBase64String($keyBytes, [System.Base64FormattingOptions]::InsertLineBreaks)
        $keyPem = "-----BEGIN RSA PRIVATE KEY-----`r`n$keyBase64`r`n-----END RSA PRIVATE KEY-----"
        Set-Content -Path "key.pem" -Value $keyPem -Encoding Ascii
        Write-Host "Created key.pem (PKCS#1)"
    }
    else {
        throw "Could not export private key. Use a newer version of PowerShell or .NET."
    }
    
} catch {
    Write-Error "Failed to generate certificate: $_"
    exit 1
}
