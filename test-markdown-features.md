# Teste de Marcações Markdown

Este documento testa todas as principais marcações de texto Markdown para verificar se estão sendo renderizadas corretamente no preview.

## Formatação de Texto

### Texto Básico
Texto normal em parágrafo.

**Texto em negrito** ou __negrito alternativo__

*Texto em itálico* ou _itálico alternativo_

***Texto em negrito e itálico*** ou ___negrito e itálico alternativo___

~~Texto tachado~~ (strikethrough)

### Código Inline
Este é um exemplo de `código inline` no meio do texto.

### Blocos de Código

```javascript
// Código JavaScript com syntax highlighting
function hello(name) {
    console.log(`Hello, ${name}!`);
    return true;
}
```

```python
# Código Python com syntax highlighting
def hello(name):
    print(f"Hello, {name}!")
    return True
```

```bash
# Comandos bash
echo "Hello World"
ls -la
```

### Listas

#### Lista não ordenada
- Item 1
- Item 2
  - Subitem 2.1
  - Subitem 2.2
- Item 3

#### Lista ordenada
1. Primeiro item
2. Segundo item
   1. Subitem 2.1
   2. Subitem 2.2
3. Terceiro item

#### Lista de tarefas (se suportado)
- [x] Tarefa completa
- [ ] Tarefa pendente
- [ ] Outra tarefa pendente

### Citações (Blockquotes)

> Esta é uma citação simples.
> Pode ter múltiplas linhas.

> Esta é uma citação com **formatação** e `código`.

### Links e Imagens

[Link para Google](https://www.google.com)

[Link com título](https://www.github.com "GitHub")

### Tabelas

| Coluna 1 | Coluna 2 | Coluna 3 |
|----------|----------|----------|
| Célula 1 | Célula 2 | Célula 3 |
| Célula 4 | Célula 5 | Célula 6 |
| Célula 7 | Célula 8 | Célula 9 |

| Alinhamento | Esquerda | Centro | Direita |
|-------------|:---------|:------:|--------:|
| Exemplo     | Texto    | Texto  | Texto   |

### Linha Horizontal

---

### Títulos (Headers)

# H1 - Título Nível 1
## H2 - Título Nível 2
### H3 - Título Nível 3
#### H4 - Título Nível 4
##### H5 - Título Nível 5
###### H6 - Título Nível 6

### Escape de Caracteres

\* Asterisco sem itálico \*

\_ Underline sem itálico \_

\# Hash sem título

### Combinações

Este parágrafo contém **negrito**, *itálico*, `código inline`, e um [link](https://example.com) tudo junto.

> Citação com **negrito**, *itálico*, e `código`.
>
> - Item de lista em citação
> - Outro item

### HTML (se suportado)

<strong>HTML strong tag</strong>

<em>HTML em tag</em>

<mark>Texto destacado com mark</mark>

H<sub>2</sub>O (Subscrito) e E=mc<sup>2</sup> (Sobrescrito)

Pressione <kbd>Ctrl</kbd> + <kbd>S</kbd> para salvar

<abbr title="HyperText Markup Language">HTML</abbr> é uma linguagem de marcação

<small>Texto pequeno para notas de rodapé</small>

<ins>Texto inserido</ins> e <del>texto deletado</del>

#### Definition List

<dl>
  <dt>Markdown</dt>
  <dd>Uma linguagem de marcação leve para formatação de texto</dd>

  <dt>Preview</dt>
  <dd>Visualização em tempo real do documento renderizado</dd>
</dl>

### Caracteres Especiais

&copy; Copyright
&reg; Registered
&trade; Trademark
&lt; Menor que
&gt; Maior que
&amp; E comercial

---

## Resultado Esperado

✅ Todas as marcações acima devem ser renderizadas corretamente no preview.
